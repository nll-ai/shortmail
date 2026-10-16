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
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=86400, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
