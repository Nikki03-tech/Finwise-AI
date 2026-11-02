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
  assert.equal(typeof healthData.marketDataConfigured, "boolean");
  assert.equal(typeof healthData.newsConfigured, "boolean");

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


test("serves only public Supabase client configuration", async (t) => {
  const previous = {
    url: process.env.SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.SUPABASE_URL = "https://demo-project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "public-anon-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "must-never-be-returned";
  const { server, baseUrl } = await startServer();

  t.after(async () => {
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previous.anon;
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  });

  const response = await fetch(`${baseUrl}/config`);
  const config = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(config, {
    supabaseUrl: "https://demo-project.supabase.co",
    supabaseAnonKey: "public-anon-test-key",
  });
  assert.equal(JSON.stringify(config).includes("must-never-be-returned"), false);
});
