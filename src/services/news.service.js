const BASE_URL = "https://gnews.io/api/v4";
const NEWS_TTL_MS = 15 * 60_000;

function newsError(message, code = "NEWS_PROVIDER_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createNewsService({
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

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

    const url = new URL("/api/v4/search", BASE_URL);
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("lang", "en");
    url.searchParams.set("country", "in");
    url.searchParams.set("max", String(count));
    url.searchParams.set("sortby", "publishedAt");
    // GNews documents API-key authentication through the apikey query parameter.
    // This adapter runs only on the server; the key is never returned to the browser.
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

    const articles = (Array.isArray(payload.articles) ? payload.articles : [])
      .slice(0, count)
      .map((article) => ({
        title: article.title || "",
        description: (article.description || "").slice(0, 600),
        url: article.url || null,
        image: article.image || null,
        publishedAt: article.publishedAt || null,
        source: article.source?.name || null,
        sourceUrl: article.source?.url || null,
      }))
      .filter((article) => article.title && article.url);

    const result = {
      provider: "GNews",
      providerUrl: "https://gnews.io/",
      query: cleanQuery,
      totalArticles: Number(payload.totalArticles) || articles.length,
      articles,
      retrievedAt: new Date(now()).toISOString(),
      freshnessNote: "The GNews Free plan can delay articles by up to 12 hours. Check each article's publication time. Plan and licensing terms apply.",
    };

    cache.set(cacheKey, { value: result, expiresAt: now() + NEWS_TTL_MS });
    return result;
  }

  return { searchNews };
}

const newsService = createNewsService();
export const searchFinancialNews = newsService.searchNews;
