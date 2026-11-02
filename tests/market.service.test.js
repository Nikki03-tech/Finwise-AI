import assert from "node:assert/strict";
import test from "node:test";
import { createMarketService } from "../src/services/market.service.js";

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

test("fetches a market quote server-side and caches it briefly", async () => {
  let calls = 0;
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-market-key" },
    now: () => 1_800_000_000_000,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url.pathname, "/quote");
      assert.equal(url.searchParams.get("symbol"), "TCS");
      assert.equal(url.searchParams.get("exchange"), "NSE");
      assert.equal(options.headers.Authorization, "apikey test-market-key");
      return jsonResponse({
        symbol: "TCS",
        name: "Tata Consultancy Services",
        exchange: "NSE",
        currency: "INR",
        close: "3456.75",
        datetime: "2026-11-02 15:30:00",
        exchange_timezone: "Asia/Kolkata",
        is_market_open: false,
        percent_change: "1.25",
      });
    },
  });

  const first = await service.getQuote({ symbol: "tcs", exchange: "nse" });
  const second = await service.getQuote({ symbol: "TCS", exchange: "NSE" });

  assert.equal(first.price, 3456.75);
  assert.equal(first.currency, "INR");
  assert.equal(first.marketTimestamp, "2026-11-02 15:30:00");
  assert.equal(first.exchangeTimezone, "Asia/Kolkata");
  assert.equal(first.isMarketOpen, false);
  assert.equal(second.price, 3456.75);
  assert.equal(calls, 1);
});

test("searches symbols and returns exchange identifiers", async () => {
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-market-key" },
    fetchImpl: async (url) => {
      assert.equal(url.pathname, "/symbol_search");
      assert.equal(url.searchParams.get("symbol"), "Tata Consultancy");
      assert.equal(url.searchParams.get("outputsize"), "15");
      return jsonResponse({
        status: "ok",
        data: [{
          symbol: "TCS",
          instrument_name: "Tata Consultancy Services",
          exchange: "NSE",
          mic_code: "XNSE",
          country: "India",
          currency: "INR",
          access: { global: "Basic", plan: "Basic" },
        }],
      });
    },
  });

  const result = await service.searchSymbols("Tata Consultancy");
  assert.equal(result.results[0].symbol, "TCS");
  assert.equal(result.results[0].exchange, "NSE");
  assert.equal(result.results[0].access.plan, "Basic");
});

test("normalizes historical time series and preserves the exchange timezone", async () => {
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-market-key" },
    fetchImpl: async (url) => {
      assert.equal(url.pathname, "/time_series");
      assert.equal(url.searchParams.get("interval"), "1day");
      return jsonResponse({
        meta: { symbol: "TCS", exchange: "NSE", currency: "INR", exchange_timezone: "Asia/Kolkata" },
        values: [{
          datetime: "2026-11-02",
          open: "100",
          high: "110",
          low: "95",
          close: "105",
          volume: "1000",
        }],
      });
    },
  });

  const result = await service.getHistory({
    symbol: "TCS",
    exchange: "NSE",
    interval: "1day",
    outputsize: 30,
  });

  assert.equal(result.values[0].close, 105);
  assert.equal(result.exchangeTimezone, "Asia/Kolkata");
  assert.equal(result.values[0].volume, 1000);
});

test("validates quote exchange and ticker before network access", async () => {
  let calls = 0;
  const service = createMarketService({
    env: { TWELVE_DATA_API_KEY: "test-market-key" },
    fetchImpl: async () => { calls += 1; return jsonResponse({}); },
  });

  await assert.rejects(
    service.getQuote({ symbol: "TCS", exchange: "NASDAQ" }),
    { code: "INVALID_MARKET_EXCHANGE" },
  );
  await assert.rejects(
    service.getQuote({ symbol: "TCS", exchange: "NSE;apikey=leak" }),
    { code: "INVALID_MARKET_EXCHANGE" },
  );
  assert.equal(calls, 0);
});

test("returns a clear configuration error when market key is missing", async () => {
  const service = createMarketService({ env: {}, fetchImpl: async () => jsonResponse({}) });
  await assert.rejects(
    service.getQuote({ symbol: "TCS", exchange: "NSE" }),
    { code: "MARKET_NOT_CONFIGURED" },
  );
});
