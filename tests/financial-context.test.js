import assert from "node:assert/strict";
import test from "node:test";
import { createFinancialContextService } from "../src/services/financial-context.service.js";

test("fetches a quote only when ticker and NSE/BSE are explicitly stated", async () => {
  let request;
  const service = createFinancialContextService({
    quote: async (input) => {
      request = input;
      return { provider: "Twelve Data", symbol: "TCS", price: 100 };
    },
    news: async () => ({ provider: "GNews", articles: [] }),
  });

  const result = await service("What is the stock price of TCS on NSE?");

  assert.deepEqual(request, { symbol: "TCS", exchange: "NSE" });
  assert.equal(result.market.status, "available");
  assert.equal(result.market.price, 100);
});

test("asks for details instead of guessing an exchange or ticker", async () => {
  let calls = 0;
  const service = createFinancialContextService({
    quote: async () => { calls += 1; return {}; },
  });

  const result = await service("What is the latest stock price?");
  assert.equal(result.market.status, "needs_details");
  assert.match(result.market.message, /ticker and exchange/i);
  assert.equal(calls, 0);
});

test("extracts the requested subject before asking for news", async () => {
  let search;
  const service = createFinancialContextService({
    news: async (query) => {
      search = query;
      return { provider: "GNews", articles: [] };
    },
  });

  const result = await service("Show me the latest financial news about RBI.");
  assert.equal(search, "RBI");
  assert.equal(result.news.status, "available");
});

test("labels missing news provider as unavailable rather than inventing headlines", async () => {
  const service = createFinancialContextService({
    news: async () => {
      const error = new Error("not configured");
      error.code = "NEWS_NOT_CONFIGURED";
      throw error;
    },
  });

  const result = await service("Show me recent news about RBI.");
  assert.equal(result.news.status, "unavailable");
  assert.match(result.news.message, /GNEWS_API_KEY/);
});

test("does not call external providers for an ordinary educational question", async () => {
  let calls = 0;
  const service = createFinancialContextService({
    quote: async () => { calls += 1; return {}; },
    news: async () => { calls += 1; return {}; },
  });

  const result = await service("Explain compound interest in simple terms.");
  assert.deepEqual(result, {});
  assert.equal(calls, 0);
});
