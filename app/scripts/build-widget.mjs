import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

// The widget is a standalone IIFE: it inlines the Convex SITE url at build
// time (public value, safe to bake) so customers never configure anything.
// Env resolution order: shell → .env.local (local builds) — on Vercel the
// environment is provided per-deployment (prod/preview backends differ).
function envValue(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  try {
    const env = readFileSync(".env.local", "utf8");
    const match = env.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim();
  } catch {
    // no .env.local — fall through
  }
  return "";
}

function convexSiteUrl() {
  // Local deployments publish an explicit site origin. Hosted ones only
  // have the .convex.cloud URL, and HTTP actions live on the .site twin.
  const explicit = envValue("NEXT_PUBLIC_CONVEX_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  return envValue("NEXT_PUBLIC_CONVEX_URL").replace(
    ".convex.cloud",
    ".convex.site",
  );
}

const convexSite = convexSiteUrl();
if (!convexSite) {
  console.error(
    "widget build: NEXT_PUBLIC_CONVEX_URL or NEXT_PUBLIC_CONVEX_SITE_URL is not set",
  );
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
