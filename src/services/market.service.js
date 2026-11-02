const BASE_URL = "https://api.twelvedata.com";
const QUOTE_TTL_MS = 60_000;
const SEARCH_TTL_MS = 10 * 60_000;
const HISTORY_TTL_MS = 5 * 60_000;

function providerError(message, code = "MARKET_PROVIDER_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function configuredKey(env) {
  const key = env.TWELVE_DATA_API_KEY?.trim();
  if (!key || key === "replace_with_your_twelve_data_api_key") {
    throw providerError("Market data provider is not configured.", "MARKET_NOT_CONFIGURED");
  }
  return key;
}

export function createMarketService({
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

  function readCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (item.expiresAt <= now()) {
      cache.delete(key);
      return null;
    }
    return item.value;
  }

  function writeCache(key, value, ttl) {
    if (cache.size > 500) {
      for (const [cacheKey, item] of cache) {
        if (item.expiresAt <= now()) cache.delete(cacheKey);
      }
    }
    cache.set(key, { value, expiresAt: now() + ttl });
  }

  async function request(endpoint, params) {
    const apiKey = configuredKey(env);
    const url = new URL(endpoint, BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Authorization: `apikey ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      const error = providerError("Market data provider could not be reached.");
      error.cause = cause;
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw providerError("Market data provider returned an invalid response.");
    }

    if (!response.ok || payload?.status === "error" || payload?.code) {
      // Twelve Data can report provider errors in a JSON payload even when the
      // HTTP response itself is 200. Prefer its numeric error code when present.
      const providerStatus = Number(payload?.code);
      const status = providerStatus || response.status || 502;
      const code = status === 429 ? "MARKET_RATE_LIMIT"
        : status === 401 || status === 403 ? "MARKET_ACCESS_DENIED"
        : status === 404 ? "MARKET_QUOTE_UNAVAILABLE"
        : "MARKET_PROVIDER_ERROR";
      const error = providerError(
        status === 429
          ? "Market data provider rate limit reached."
          : "Market data provider rejected the request.",
        code,
      );
      error.status = status;
      throw error;
    }

    return payload;
  }

  async function searchSymbols(query) {
    const clean = String(query || "").trim();
    if (clean.length < 2 || clean.length > 80) {
      throw providerError("Search text must contain between 2 and 80 characters.", "INVALID_MARKET_QUERY");
    }

    const cacheKey = `search:${clean.toLowerCase()}`;
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const payload = await request("/symbol_search", { symbol: clean, outputsize: 15 });
    const rows = Array.isArray(payload.data) ? payload.data : [];

    const result = {
      provider: "Twelve Data",
      sourceUrl: "https://twelvedata.com/",
      retrievedAt: new Date(now()).toISOString(),
      results: rows.slice(0, 15).map((item) => ({
        symbol: item.symbol || null,
        name: item.instrument_name || item.name || null,
        exchange: item.exchange || null,
        micCode: item.mic_code || null,
        country: item.country || null,
        currency: item.currency || null,
        instrumentType: item.instrument_type || item.type || null,
        access: item.access ? {
          global: item.access.global || null,
          plan: item.access.plan || null,
        } : null,
      })),
      note: "Exchange coverage and quote freshness depend on provider entitlements.",
    };

    writeCache(cacheKey, result, SEARCH_TTL_MS);
    return result;
  }

  async function getQuote({ symbol, exchange }) {
    const cleanSymbol = String(symbol || "").trim().toUpperCase();
    const cleanExchange = String(exchange || "").trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(cleanSymbol)) {
      throw providerError("Provide a valid stock symbol.", "INVALID_MARKET_SYMBOL");
    }
    if (!["NSE", "BSE"].includes(cleanExchange)) {
      throw providerError("Exchange must be NSE or BSE.", "INVALID_MARKET_EXCHANGE");
    }

    const cacheKey = `quote:${cleanExchange}:${cleanSymbol}`;
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const payload = await request("/quote", {
      symbol: cleanSymbol,
      exchange: cleanExchange,
    });

    const price = Number(payload.close ?? payload.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw providerError("A valid quote is not currently available for that symbol and exchange.", "MARKET_QUOTE_UNAVAILABLE");
    }

    const result = {
      provider: "Twelve Data",
      sourceUrl: "https://twelvedata.com/",
      symbol: payload.symbol || cleanSymbol,
      name: payload.name || null,
      exchange: payload.exchange || cleanExchange,
      micCode: payload.mic_code || null,
      currency: payload.currency || null,
      price,
      open: nullableNumber(payload.open),
      high: nullableNumber(payload.high),
      low: nullableNumber(payload.low),
      previousClose: nullableNumber(payload.previous_close),
      change: nullableNumber(payload.change),
      percentChange: nullableNumber(payload.percent_change),
      volume: nullableNumber(payload.volume),
      marketTimestamp: payload.datetime || payload.timestamp || null,
      exchangeTimezone: payload.exchange_timezone || null,
      isMarketOpen: typeof payload.is_market_open === "boolean" ? payload.is_market_open : null,
      retrievedAt: new Date(now()).toISOString(),
      freshnessNote: "Quote availability and delay depend on the provider plan and exchange entitlements; check the market timestamp.",
    };

    writeCache(cacheKey, result, QUOTE_TTL_MS);
    return result;
  }

  async function getHistory({ symbol, exchange, interval = "1day", outputsize = 30 }) {
    const cleanSymbol = String(symbol || "").trim().toUpperCase();
    const cleanExchange = String(exchange || "").trim().toUpperCase();
    const allowedIntervals = new Set(["1day", "1week", "1month"]);
    if (!/^[A-Z0-9][A-Z0-9._-]{0,19}$/.test(cleanSymbol)) {
      throw providerError("Provide a valid stock symbol.", "INVALID_MARKET_SYMBOL");
    }
    if (!["NSE", "BSE"].includes(cleanExchange)) {
      throw providerError("Exchange must be NSE or BSE.", "INVALID_MARKET_EXCHANGE");
    }
    if (!allowedIntervals.has(interval)) {
      throw providerError("Interval must be 1day, 1week, or 1month.", "INVALID_MARKET_INTERVAL");
    }
    const count = Number(outputsize);
    if (!Number.isInteger(count) || count < 5 || count > 100) {
      throw providerError("Output size must be between 5 and 100.", "INVALID_MARKET_HISTORY_SIZE");
    }

    const cacheKey = `history:${cleanExchange}:${cleanSymbol}:${interval}:${count}`;
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const payload = await request("/time_series", {
      symbol: cleanSymbol,
      exchange: cleanExchange,
      interval,
      outputsize: count,
      format: "JSON",
    });

    if (!Array.isArray(payload.values) || payload.values.length === 0) {
      throw providerError("Historical data is not currently available for that symbol.", "MARKET_HISTORY_UNAVAILABLE");
    }

    const values = payload.values.map((item) => ({
      datetime: item.datetime,
      open: nullableNumber(item.open),
      high: nullableNumber(item.high),
      low: nullableNumber(item.low),
      close: nullableNumber(item.close),
      volume: nullableNumber(item.volume),
    })).filter((item) =>
      item.datetime &&
      [item.open, item.high, item.low, item.close].every(Number.isFinite)
    );

    if (values.length === 0) {
      throw providerError("Historical data did not contain usable price points.", "MARKET_HISTORY_UNAVAILABLE");
    }

    const result = {
      provider: "Twelve Data",
      sourceUrl: "https://twelvedata.com/",
      symbol: payload.meta?.symbol || cleanSymbol,
      exchange: payload.meta?.exchange || cleanExchange,
      currency: payload.meta?.currency || null,
      exchangeTimezone: payload.meta?.exchange_timezone || null,
      interval,
      values,
      retrievedAt: new Date(now()).toISOString(),
      note: "Historical values are provider data and are not a prediction of future performance.",
    };

    writeCache(cacheKey, result, HISTORY_TTL_MS);
    return result;
  }

  return { searchSymbols, getQuote, getHistory };
}

const marketService = createMarketService();

export const searchMarketSymbols = marketService.searchSymbols;
export const getMarketQuote = marketService.getQuote;
export const getMarketHistory = marketService.getHistory;
