import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth-gated pages (WorkOS cookies) + Convex client need plain dynamic
  // rendering; Cache Components' prerender pass breaks them (verified P0).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // No Content-Security-Policy is set. Vercel Web Analytics loads
    // `/_vercel/insights/script.js` same-origin on Next.js pages. If a CSP
    // is added later, allow `script-src 'self'` (covers `/_vercel/insights/*`)
    // and `connect-src 'self'`. Do not put that script in `/widget.js`;
    // third-party host CSPs must not need Vercel insights for the embed.
    return [
      {
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            // /widget.js must track deploys: a stale edge copy shows an
            // outdated form on every page that mounts the widget.
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
