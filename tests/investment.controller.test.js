import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createInvestmentController } from "../src/controllers/investment.controller.js";

async function request(body) {
  const app = express();
  app.use(express.json());
  app.post("/investment/sip", createInvestmentController().calculateSIP);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/investment/sip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, data: await response.json() };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

test("calculates SIP with an explicit annual-return assumption", async () => {
  const { response, data } = await request({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 10,
  });

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.calculation.totalInvested, 300000);
  assert.equal(data.data.annualReturnIsAssumed, false);
});

test("clearly flags the illustrative default annual-return assumption", async () => {
  const { response, data } = await request({
    monthlyInvestment: 5000,
    years: 5,
  });

  assert.equal(response.status, 200);
  assert.equal(data.data.calculation.annualReturn, 12);
  assert.equal(data.data.annualReturnIsAssumed, true);
  assert.match(data.data.disclaimer, /not guaranteed/i);
});

test("rejects invalid SIP inputs", async () => {
  const { response, data } = await request({
    monthlyInvestment: 5000,
    years: 5,
    annualReturn: 150,
  });

  assert.equal(response.status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /Annual return must be 0 or greater/);
});
