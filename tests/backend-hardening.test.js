import assert from "node:assert/strict";
import test from "node:test";
import { createMarketService } from "../src/services/market.service.js";
import { createNewsService } from "../src/services/news.service.js";
import { isGeminiConfigured } from "../src/config/env.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("market quote preserves absent optional numeric fields as null", async () => {
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-key" },
    fetchImpl: async () => jsonResponse({
      symbol: "TCS",
      close: "100.25",
      open: null,
      high: "",
      low: "0",
      previous_close: undefined,
      change: null,
      percent_change: "",
      volume: undefined,
    }),
  });

  const quote = await service.getQuote({ symbol: "TCS", exchange: "NSE" });
  assert.equal(quote.price, 100.25);
  assert.equal(quote.open, null);
  assert.equal(quote.high, null);
  assert.equal(quote.low, 0);
  assert.equal(quote.previousClose, null);
  assert.equal(quote.change, null);
  assert.equal(quote.percentChange, null);
  assert.equal(quote.volume, null);
});

test("market provider JSON rate-limit errors are classified even on HTTP 200", async () => {
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-key" },
    fetchImpl: async () => jsonResponse({
      status: "error",
      code: 429,
      message: "provider quota details",
    }),
  });

  await assert.rejects(
    service.getQuote({ symbol: "TCS", exchange: "NSE" }),
    { code: "MARKET_RATE_LIMIT" },
  );
});

test("market history rejects empty and unusable provider series", async () => {
  for (const values of [[], [{ datetime: "2026-11-02", open: "bad", high: "1", low: "1", close: "1" }]]) {
    const service = createMarketService({
      env: { TWELVE_DATA_API_KEY: "test-key" },
      fetchImpl: async () => jsonResponse({ values }),
    });

    await assert.rejects(
      service.getHistory({ symbol: "TCS", exchange: "NSE", outputsize: 5 }),
      { code: "MARKET_HISTORY_UNAVAILABLE" },
    );
  }
});

test("news results discard unsafe article, image, and publisher URLs", async () => {
  const service = createNewsService({
    env: { GNEWS_API_KEY: "test-key" },
    fetchImpl: async () => jsonResponse({
      totalArticles: 2,
      articles: [
        {
          title: "Unsafe link",
          url: "javascript:alert(1)",
          image: "data:text/html,unsafe",
          source: { name: "Bad source", url: "javascript:alert(2)" },
        },
        {
          title: "Safe link",
          url: "https://example.com/story",
          image: "https://example.com/image.png",
          source: { name: "Example", url: "https://example.com" },
        },
      ],
    }),
  });

  const result = await service.searchNews("Indian markets");
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].title, "Safe link");
  assert.equal(result.articles[0].url, "https://example.com/story");
  assert.equal(result.articles[0].image, "https://example.com/image.png");
});

test("Gemini placeholder from the example environment is not treated as configured", () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "replace_with_your_gemini_api_key";
  try {
    assert.equal(isGeminiConfigured(), false);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
