import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

// The widget is a standalone IIFE: it inlines the Convex SITE url at build
// time (public value, safe to bake) so customers never configure anything.
// Env resolution order: shell → .env.local (local builds) — on Vercel the
// environment is provided per-deployment (prod/preview backends differ).
function convexSiteUrl() {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_URL;
  }
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // no .env.local — fall through
  }
  return "";
}

const convexSite = convexSiteUrl().replace(".convex.cloud", ".convex.site");
if (!convexSite) {
  console.error("widget build: NEXT_PUBLIC_CONVEX_URL is not set");
  process.exit(1);
}

await esbuild.build({
  entryPoints: ["src/widget/shortmail-widget.ts"],
  bundle: true,
  format: "iife",
  minify: true,
  outfile: "public/widget.js",
  define: {
    "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(convexSite),
  },
});
console.log(`widget.js built (convex site: ${convexSite})`);
