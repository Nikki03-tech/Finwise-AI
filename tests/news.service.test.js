import assert from "node:assert/strict";
import test from "node:test";
import { createNewsService } from "../src/services/news.service.js";

test("searches Indian English news with the GNews key in the backend request", async () => {
  let calls = 0;
  const service = createNewsService({
    env: { GNEWS_API_KEY: "test-news-key" },
    now: () => 1_800_000_000_000,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url.hostname, "gnews.io");
      assert.equal(url.pathname, "/api/v4/search");
      assert.equal(url.searchParams.get("q"), "RBI policy news");
      assert.equal(url.searchParams.get("lang"), "en");
      assert.equal(url.searchParams.get("country"), "in");
      assert.equal(url.searchParams.get("apikey"), "test-news-key");
      assert.equal(options.headers["X-Api-Key"], undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalArticles: 1,
          articles: [{
            title: "Example RBI update",
            description: "A short provider description.",
            url: "https://example.com/rbi-update",
            publishedAt: "2026-11-02T09:00:00Z",
            source: { name: "Example News", url: "https://example.com" },
          }],
        }),
      };
    },
  });

  const first = await service.searchNews("RBI policy news", { max: 5 });
  const second = await service.searchNews("RBI policy news", { max: 5 });

  assert.equal(first.articles[0].source, "Example News");
  assert.equal(first.articles[0].publishedAt, "2026-11-02T09:00:00Z");
  assert.match(first.freshnessNote, /up to 12 hours/);
  assert.equal(second.totalArticles, 1);
  assert.equal(calls, 1);
});

test("does not contact GNews without an API key", async () => {
  let calls = 0;
  const service = createNewsService({
    env: {},
    fetchImpl: async () => { calls += 1; throw new Error("should not run"); },
  });

  await assert.rejects(service.searchNews("RBI news"), { code: "NEWS_NOT_CONFIGURED" });
  assert.equal(calls, 0);
});

test("rejects an unsupported news result count", async () => {
  const service = createNewsService({
    env: { GNEWS_API_KEY: "test-news-key" },
    fetchImpl: async () => { throw new Error("should not run"); },
  });

  await assert.rejects(
    service.searchNews("RBI news", { max: 11 }),
    { code: "INVALID_NEWS_LIMIT" },
  );
});

test("classifies provider access denial separately from rate limiting", async () => {
  const service = createNewsService({
    env: { GNEWS_API_KEY: "test-news-key" },
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ errors: ["access denied"] }),
    }),
  });

  await assert.rejects(
    service.searchNews("RBI"),
    { code: "NEWS_ACCESS_DENIED" },
  );
});
