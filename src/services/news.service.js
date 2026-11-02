const BASE_URL = "https://gnews.io/api/v4";
const NEWS_TTL_MS = 15 * 60_000;
const INDIA_MARKET_FALLBACK_QUERY = "stock OR stocks OR market OR markets OR share OR shares";

function newsError(message, code = "NEWS_PROVIDER_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function normalizeArticles(payload, count) {
  return (Array.isArray(payload?.articles) ? payload.articles : [])
    .slice(0, count)
    .map((article) => ({
      title: typeof article.title === "string" ? article.title.slice(0, 300) : "",
      description: typeof article.description === "string" ? article.description.slice(0, 600) : "",
      url: safeHttpUrl(article.url),
      image: safeHttpUrl(article.image),
      publishedAt: article.publishedAt || null,
      source: article.source?.name || null,
      sourceUrl: safeHttpUrl(article.source?.url),
    }))
    .filter((article) => article.title && article.url);
}

export function createNewsService({
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

  async function request(endpoint, params, apiKey) {
    const url = new URL(endpoint, BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    // Keep GNews authentication server-side. GNews supports the apikey query
    // parameter; the key is never passed to or returned by the browser.
    url.searchParams.set("apikey", apiKey);

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      const error = newsError("Financial news provider could not be reached.");
      error.cause = cause;
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw newsError("Financial news provider returned an invalid response.");
    }

    if (!response.ok || payload?.errors) {
      const status = response.status || 502;
      const code = status === 429 ? "NEWS_RATE_LIMIT"
        : status === 403 ? "NEWS_ACCESS_DENIED"
        : "NEWS_PROVIDER_ERROR";
      const message = status === 429
        ? "Financial news provider rate limit reached."
        : status === 403
          ? "Financial news provider denied access; check the API key and plan."
          : "Financial news provider rejected the request.";
      const error = newsError(message, code);
      error.status = status;
      throw error;
    }

    return payload;
  }

  async function searchNews(query, { max = 5 } = {}) {
    const apiKey = env.GNEWS_API_KEY?.trim();
    if (!apiKey || apiKey === "replace_with_your_gnews_api_key") {
      throw newsError("Financial news provider is not configured.", "NEWS_NOT_CONFIGURED");
    }

    const cleanQuery = String(query || "").trim();
    if (cleanQuery.length < 2 || cleanQuery.length > 200) {
      throw newsError("News search must contain between 2 and 200 characters.", "INVALID_NEWS_QUERY");
    }

    const count = Number(max);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      throw newsError("News result count must be between 1 and 10.", "INVALID_NEWS_LIMIT");
    }

    const cacheKey = `${cleanQuery.toLowerCase()}:${count}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.value;
    if (cached) cache.delete(cacheKey);

    let payload = await request("/api/v4/search", {
      q: cleanQuery,
      lang: "en",
      country: "in",
      max: count,
      sortby: "publishedAt",
    }, apiKey);
    let articles = normalizeArticles(payload, count);
    let fallbackUsed = false;

    // A broad Indian stock-market request can be phrased too narrowly for a
    // keyword search. When it returns no usable articles, try GNews' business
    // top-headlines endpoint with India and market terms rather than inventing
    // stories or returning an empty result without trying the headlines feed.
    const isBroadIndiaMarketQuery =
      /\b(india|indian)\b/i.test(cleanQuery) &&
      /\b(stock|stocks|market|markets|share|shares|equity|equities)\b/i.test(cleanQuery);

    if (articles.length === 0 && isBroadIndiaMarketQuery) {
      payload = await request("/api/v4/top-headlines", {
        category: "business",
        lang: "en",
        country: "in",
        max: count,
        q: INDIA_MARKET_FALLBACK_QUERY,
      }, apiKey);
      articles = normalizeArticles(payload, count);
      fallbackUsed = true;
    }

    const totalArticlesValue = Number(payload?.totalArticles);
    const result = {
      provider: "GNews",
      providerUrl: "https://gnews.io/",
      query: cleanQuery,
      totalArticles: Number.isFinite(totalArticlesValue) ? totalArticlesValue : articles.length,
      articles,
      fallbackUsed,
      fallbackNote: fallbackUsed
        ? "The topic search returned no usable articles; Indian business top headlines filtered for stock-market terms were tried instead."
        : null,
      retrievedAt: new Date(now()).toISOString(),
      freshnessNote: "The GNews Free plan can delay articles by up to 12 hours. Check each article's publication time. Plan and licensing terms apply.",
    };

    if (cache.size > 500) {
      for (const [key, item] of cache) {
        if (item.expiresAt <= now()) cache.delete(key);
      }
      while (cache.size >= 500) cache.delete(cache.keys().next().value);
    }
    cache.set(cacheKey, { value: result, expiresAt: now() + NEWS_TTL_MS });
    return result;
  }

  return { searchNews };
}

const newsService = createNewsService();

export const searchFinancialNews = newsService.searchNews;
