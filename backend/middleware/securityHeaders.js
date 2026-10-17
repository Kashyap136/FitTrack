const config = require('../config/env');

/**
 * Dependency-free, helmet-style security headers.
 *
 * Kept in-repo (rather than adding `helmet`) so production hardening does not
 * introduce a runtime dependency. The values mirror helmet's sensible defaults
 * with two deliberate choices for this app:
 *   - `Cross-Origin-Resource-Policy: cross-origin` so the separately hosted
 *     frontend can load avatar images from `/uploads`.
 *   - A minimal `Content-Security-Policy` suited to a JSON API (`default-src
 *     'none'`); document-level pages are served by the Next.js frontend.
 * HSTS is only emitted in production (it is ignored over plain HTTP anyway).
 */
function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
}

module.exports = { securityHeaders };
