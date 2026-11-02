import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../src/middleware/rate-limit.js";

function run(middleware, req) {
  let nextCalls = 0;
  let statusCode = 200;
  let body;
  const headers = {};
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    status: (code) => {
      statusCode = code;
      return { json: (value) => { body = value; return body; } };
    },
  };
  middleware(req, res, () => { nextCalls += 1; });
  return { nextCalls, statusCode, body, headers };
}

test("rate limiter permits requests up to its limit, then returns 429", () => {
  let time = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 5_000, now: () => time });
  const req = { ip: "127.0.0.1" };

  assert.equal(run(limiter, req).nextCalls, 1);
  assert.equal(run(limiter, req).nextCalls, 1);
  const blocked = run(limiter, req);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.success, false);

  time += 5_001;
  assert.equal(run(limiter, req).nextCalls, 1);
});

test("different route limiters maintain independent buckets", () => {
  const first = createRateLimiter({ limit: 1, now: () => 100 });
  const second = createRateLimiter({ limit: 1, now: () => 100 });
  const req = { ip: "127.0.0.1" };

  assert.equal(run(first, req).nextCalls, 1);
  assert.equal(run(second, req).nextCalls, 1);
});
