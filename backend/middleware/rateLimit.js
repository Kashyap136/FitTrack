const { ApiError } = require('../utils/validators');

/**
 * Dependency-free fixed-window rate limiter for sensitive endpoints.
 *
 * The app runs as a single instance, so a small in-process map is enough to
 * blunt brute-force attempts against the auth routes without pulling in extra
 * infrastructure. Keys are per-IP (per bucket) and windows reset lazily.
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 60,
  message = 'Too many requests. Please slow down and try again shortly.',
} = {}) {
  const hits = new Map();
  let lastPrune = Date.now();

  const prune = (now) => {
    if (now - lastPrune < windowMs) return;
    lastPrune = now;
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  };

  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return next(new ApiError(429, message));
    }

    return next();
  };
}

module.exports = { createRateLimiter };
