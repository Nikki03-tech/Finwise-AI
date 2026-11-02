import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createChatController } from "../src/controllers/chat.controller.js";

async function startTestServer(controller) {
  const app = express();
  app.use(express.json());
  app.post("/chat", controller);
  const server = app.listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/chat`,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    ),
  };
}

async function postMessage(url, message) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

test("rejects an empty chat message", async (t) => {
  let called = false;
  const controller = createChatController({
    runResearchAgent: async () => { called = true; return "research"; },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(server.url, "  ");
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.success, false);
  assert.equal(called, false);
});

test("answers a general finance question without inventing SIP calculations", async (t) => {
  let investmentCalls = 0;
  let riskCalls = 0;
  const controller = createChatController({
    runResearchAgent: async () => "General finance context.",
    runInvestmentAgent: async () => { investmentCalls += 1; return {}; },
    runRiskAgent: async () => { riskCalls += 1; return {}; },
    getFinancialContext: async () => ({}),
    runDecisionAgent: async ({ investment, risk }) => {
      assert.equal(investment, null);
      assert.equal(risk, null);
      return { answer: "Inflation reduces purchasing power over time." };
    },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(server.url, "What is inflation?");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.reply, "Inflation reduces purchasing power over time.");
  assert.equal(data.data.investment, null);
  assert.equal(investmentCalls, 0);
  assert.equal(riskCalls, 0);
});

test("runs investment and risk calculations for a complete SIP question", async (t) => {
  let captured = {};
  const controller = createChatController({
    runResearchAgent: async () => "SIP context.",
    runInvestmentAgent: async (input) => {
      captured.investment = input;
      return {
        calculation: {
          monthlyInvestment: input.monthlyInvestment,
          annualReturn: input.annualReturn,
          months: input.years * 12,
          estimatedValue: 400000,
        },
        explanation: "Illustrative calculation.",
      };
    },
    runRiskAgent: async (input) => {
      captured.risk = input;
      return { analysis: "Market values can fall." };
    },
    getFinancialContext: async () => ({}),
    runDecisionAgent: async ({ sipInputs }) => {
      captured.assumed = sipInputs.annualReturnIsAssumed;
      return { answer: "Here is your illustrative SIP scenario." };
    },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(
    server.url,
    "Calculate SIP ₹5,000 per month for 5 years at 10%.",
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.investment.calculation.months, 60);
  assert.equal(captured.investment.monthlyInvestment, 5000);
  assert.equal(captured.risk.years, 5);
  assert.equal(captured.assumed, false);
});

test("returns a helpful response path when SIP details are missing", async (t) => {
  let calculationCalls = 0;
  const controller = createChatController({
    runResearchAgent: async () => "SIP educational context.",
    runInvestmentAgent: async () => { calculationCalls += 1; return {}; },
    runRiskAgent: async () => { calculationCalls += 1; return {}; },
    getFinancialContext: async () => ({}),
    runDecisionAgent: async ({ sipInputs, investment, risk }) => {
      assert.deepEqual(sipInputs.missingFields, ["monthly investment amount", "investment duration"]);
      assert.equal(investment, null);
      assert.equal(risk, null);
      return { answer: "Please share the monthly amount and duration." };
    },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(server.url, "Explain SIP to me.");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.reply, "Please share the monthly amount and duration.");
  assert.equal(calculationCalls, 0);
});

test("passes provider-sourced news context to the decision agent", async (t) => {
  let capturedContext;
  const controller = createChatController({
    runResearchAgent: async () => "General business context.",
    getFinancialContext: async () => ({
      news: {
        status: "available",
        provider: "GNews",
        articles: [{
          title: "A test headline",
          source: "Example Publisher",
          publishedAt: "2026-11-02T09:00:00Z",
          url: "https://example.com/story",
        }],
      },
    }),
    runDecisionAgent: async ({ financialContext }) => {
      capturedContext = financialContext;
      return { answer: "Here is the latest verified context." };
    },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(server.url, "Show latest news about RBI.");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(capturedContext.news.articles[0].url, "https://example.com/story");
  assert.equal(data.data.financialContext.news.provider, "GNews");
});

test("rejects unsupported SIP assumptions before calling AI agents", async (t) => {
  let agentCalls = 0;
  const controller = createChatController({
    runResearchAgent: async () => { agentCalls += 1; return "research"; },
    runInvestmentAgent: async () => { agentCalls += 1; return {}; },
    runRiskAgent: async () => { agentCalls += 1; return {}; },
    getFinancialContext: async () => { agentCalls += 1; return {}; },
    runDecisionAgent: async () => { agentCalls += 1; return { answer: "answer" }; },
  });
  const server = await startTestServer(controller);
  t.after(() => server.close());

  const response = await postMessage(
    server.url,
    "Calculate SIP ₹5,000 per month for 5 years at 150%.",
  );
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.success, false);
  assert.match(data.error, /Annual return must be 0 or greater/);
  assert.equal(agentCalls, 0);
});

test("rejects excessively long messages", async (t) => {
  const server = await startTestServer(createChatController());
  t.after(() => server.close());

  const response = await postMessage(server.url, "x".repeat(4001));
  assert.equal(response.status, 413);
});
