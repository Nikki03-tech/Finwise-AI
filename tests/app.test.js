import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

async function startServer() {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

test("serves the existing browser UI and reports liveness/readiness", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  ));

  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /FinWise AI/);

  const health = await fetch(`${baseUrl}/health`);
  const healthData = await health.json();
  assert.equal(health.status, 200);
  assert.equal(healthData.status, "ok");
  assert.equal(healthData.service, "FinWise AI");
  assert.equal(typeof healthData.aiConfigured, "boolean");

  const ready = await fetch(`${baseUrl}/health/ready`);
  const readyData = await ready.json();
  assert.equal(ready.status, healthData.aiConfigured ? 200 : 503);
  assert.equal(readyData.aiConfigured, healthData.aiConfigured);
});

test("chat returns a clear 503 without a Gemini API key", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const { server, baseUrl } = await startServer();

  t.after(async () => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  });

  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "What is inflation?" }),
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.success, false);
  assert.match(data.error, /not configured/i);
});
