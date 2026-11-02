import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createMarketController } from "../src/controllers/market.controller.js";

async function requestWith(controller, method, path) {
  const app = express();
  app.get(path, method);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}?symbol=TCS&exchange=NSE`);
    return { response, data: await response.json() };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

test("market quote controller returns normalized provider data", async () => {
  const controller = createMarketController({
    getMarketQuote: async ({ symbol, exchange }) => ({
      provider: "Twelve Data",
      symbol,
      exchange,
      price: 123.45,
      retrievedAt: "2026-11-02T12:00:00.000Z",
    }),
  });

  const { response, data } = await requestWith(controller, controller.quote, "/quote");
  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.price, 123.45);
});

test("market quote controller does not expose provider internals", async () => {
  const controller = createMarketController({
    getMarketQuote: async () => {
      const error = new Error("secret account detail and provider stack");
      error.code = "MARKET_NOT_CONFIGURED";
      throw error;
    },
  });

  const { response, data } = await requestWith(controller, controller.quote, "/quote");
  assert.equal(response.status, 503);
  assert.equal(data.success, false);
  assert.doesNotMatch(JSON.stringify(data), /secret account detail|provider stack/);
});
