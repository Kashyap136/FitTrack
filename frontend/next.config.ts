import type { NextConfig } from "next";

/**
 * Security headers applied to every frontend response.
 *
 * A strict Content-Security-Policy is intentionally omitted: Next.js injects
 * inline bootstrap scripts that require per-request nonces to whitelist
 * correctly. The remaining headers are safe defaults that do not affect
 * rendering. Add a nonce-based CSP at the edge/CDN if one is required.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
