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
