import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The widget is a standalone IIFE: it inlines the Convex SITE url at build
// time (public value, safe to bake) so customers never configure anything.
// Env resolution order: shell → .env.local (local builds). On Vercel,
// `npx convex deploy --cmd` sets NEXT_PUBLIC_CONVEX_URL to that build's
// deployment, so a preview bakes its own .convex.site host.
export function widgetConvexSite(convexUrl) {
  return String(convexUrl ?? "")
    .trim()
    .replace(".convex.cloud", ".convex.site");
}

function convexUrlFromEnv(env = process.env) {
  if (env.NEXT_PUBLIC_CONVEX_URL) return env.NEXT_PUBLIC_CONVEX_URL;
  try {
    const file = readFileSync(".env.local", "utf8");
    const match = file.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // no .env.local — fall through
  }
  return "";
}

async function buildWidget() {
  const convexSite = widgetConvexSite(convexUrlFromEnv());
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
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  await buildWidget();
}
