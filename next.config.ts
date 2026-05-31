import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in middleware.ts with a nonce
// (Next.js's RSC streaming emits dynamic inline <script> tags that a static
// hash can't cover). Other security headers are static and live here.
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // pdfjs (legacy build) and @napi-rs/canvas both ship native or
  // platform-specific bits that Next's bundler garbles — keep them external.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
