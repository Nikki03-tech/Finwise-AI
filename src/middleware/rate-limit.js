export function createRateLimiter({
  limit = 20,
  windowMs = 60_000,
  now = () => Date.now(),
} = {}) {
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const currentTime = now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please wait a little before trying again.",
      });
    }

    if (buckets.size > 5_000) {
      for (const [address, item] of buckets) {
        if (item.resetAt <= currentTime) buckets.delete(address);
      }
    }

    return next();
  };
}
