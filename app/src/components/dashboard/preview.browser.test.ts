import { createServer, type Server } from "node:http";
import { once } from "node:events";
import esbuild from "esbuild";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire("/tmp/sm-audit/package.json");
const puppeteer = require("puppeteer-core") as {
  launch: (options: { executablePath: string; headless: string; args: string[] }) => Promise<{
    newPage: () => Promise<BrowserPage>;
    close: () => Promise<void>;
  }>;
};

type BrowserPage = {
  goto: (url: string, options?: { waitUntil: "networkidle0" }) => Promise<unknown>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<unknown>;
  setViewport: (viewport: { width: number; height: number }) => Promise<unknown>;
  click: (selector: string) => Promise<unknown>;
  waitForFunction: (fn: () => boolean, options?: { timeout: number }) => Promise<unknown>;
  evaluate: (fn: (...args: string[]) => unknown, ...args: string[]) => Promise<unknown>;
};

type PreviewState = {
  defined: boolean;
  widgetHeight: number;
  frameHeight: number;
  text: string;
  booted: boolean;
};

const LABEL = "FIXTURE — not the live dashboard";

const preview = `<p style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#737373">Live preview — what your visitors see</p>
<div id="frame" style="border:1px solid #d4d4d4;background:#fff;padding:1.5rem"><shortmail-widget vanity="fixture"></shortmail-widget></div>
<div style="border:1px solid #e5e5e5;padding:1rem;margin-top:1rem;font-size:14px">Premium tools</div>`;

const columns = (right: string) => `<main style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,26rem);gap:2rem;max-width:72rem;margin:0 auto;padding:2rem">
<section style="border:1px solid #e5e5e5;padding:1rem;font-size:14px">
<h2 style="margin:0 0 .75rem;font-size:12px;letter-spacing:.2em;text-transform:uppercase">Your send page</h2>
<p style="margin:0">Visitors write to you at <span style="font-family:ui-monospace,monospace">/send/fixture</span></p>
<h2 style="margin:2rem 0 .75rem;font-size:12px;letter-spacing:.2em;text-transform:uppercase">Subject headings</h2>
<ul style="margin:0;padding-left:1.2rem"><li>Data request</li></ul>
</section>
<aside>${right}</aside>
</main>`;

function page(body: string, script: "document" | "none" | "client"): string {
  const banner = `<style>@media (max-width:800px){main{grid-template-columns:1fr !important}}</style><p style="margin:0;padding:.5rem 1rem;background:#171717;color:#fff;font-size:12px;letter-spacing:.04em">${LABEL}</p>`;
  const loader = script === "document" ? `<script src="/widget.js" defer></script>` : "";
  const client = script === "client"
    ? `<script>
        window.__booted = true;
        document.getElementById("open").addEventListener("click", () => {
          history.pushState({}, "", "/dashboard");
          document.getElementById("view").innerHTML = ${JSON.stringify(columns(preview))};
          const tag = document.createElement("script");
          tag.src = "/widget.js";
          document.body.appendChild(tag);
        });
      </script>`
    : `<script>window.__booted = true;</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${loader}</head><body style="margin:0;background:#fff;color:#171717;font-family:system-ui,sans-serif">${banner}${body}${client}</body></html>`;
}

describe("dashboard preview registration", () => {
  let api: Server;
  let origin: Server;
  const calls: string[] = [];

  beforeAll(async () => {
    api = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      calls.push(`${req.method} ${url.pathname}`);
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        });
        res.end();
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (url.pathname === "/api/embed/fixture/config") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          vanityName: "fixture",
          displayName: "Fixture Owner",
          headings: ["Data request"],
          faqs: [],
          isPaid: false,
          theme: null,
          embedAllowedOrigins: [],
        }));
        return;
      }
      if (url.pathname === "/api/collect/fixture") {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not-the-fixture" }));
    });
    api.listen(0, "127.0.0.1");
    await once(api, "listening");
    const address = api.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const apiOrigin = `http://127.0.0.1:${address.port}`;

    await esbuild.build({
      entryPoints: ["src/widget/shortmail-widget.ts"],
      bundle: true,
      format: "iife",
      outfile: "/tmp/shortmail-widget-preview.js",
      define: {
        "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(apiOrigin),
      },
    });

    const before = page(columns(preview), "none");
    const initial = page(columns(preview), "document");
    const client = page(
      `<main id="view" style="max-width:72rem;margin:0 auto;padding:2rem"><p>Settings only. The preview has not mounted.</p><button id="open" type="button">Show live preview</button></main>`,
      "client",
    );
    origin = createServer((req, res) => {
      if (req.url?.startsWith("/widget.js")) {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(require("node:fs").readFileSync("/tmp/shortmail-widget-preview.js"));
        return;
      }
      const path = req.url?.split("?")[0];
      const html = path === "/initial" ? initial : path === "/client" ? client : before;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    origin.listen(0, "127.0.0.1");
    await once(origin, "listening");
  }, 20000);

  afterAll(() => {
    api.close();
    origin.close();
  });

  it("stays an empty frame without the script, then fills on first load and on client mount", async () => {
    const browser = await puppeteer.launch({
      executablePath: "/usr/local/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const port = (origin.address() as { port: number }).port;
    const shot = async (target: BrowserPage, stem: string): Promise<void> => {
      await target.setViewport({ width: 1440, height: 900 });
      await target.screenshot({ path: `/opt/cursor/artifacts/${stem}_desktop.png`, fullPage: true });
      await target.setViewport({ width: 390, height: 844 });
      await target.screenshot({ path: `/opt/cursor/artifacts/${stem}_mobile.png`, fullPage: true });
    };
    const read = (target: BrowserPage) => target.evaluate(() => {
      const el = document.querySelector("shortmail-widget");
      const frame = document.getElementById("frame");
      const widgetBox = el?.getBoundingClientRect();
      const frameBox = frame?.getBoundingClientRect();
      return {
        defined: !!customElements.get("shortmail-widget"),
        widgetHeight: widgetBox?.height ?? -1,
        frameHeight: frameBox?.height ?? -1,
        text: el?.shadowRoot?.textContent ?? "",
        booted: window.__booted === true,
      };
    }) as Promise<PreviewState>;

    const missing = await browser.newPage();
    await missing.goto(`http://127.0.0.1:${port}/before`, { waitUntil: "networkidle0" });
    await shot(missing, "fixture_dashboard_preview_before");
    const empty = await read(missing);
    expect(empty.defined).toBe(false);
    expect(empty.widgetHeight).toBe(0);
    expect(empty.frameHeight).toBeGreaterThan(0);
    expect(empty.frameHeight).toBeLessThan(80);
    expect(empty.text).toBe("");

    const first = await browser.newPage();
    await first.goto(`http://127.0.0.1:${port}/initial`, { waitUntil: "networkidle0" });
    await first.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("Fixture Owner") ?? false;
    }, { timeout: 10000 });
    await shot(first, "fixture_dashboard_preview_initial");
    const loaded = await read(first);
    expect(loaded.defined).toBe(true);
    expect(loaded.booted).toBe(true);
    expect(loaded.text).toContain("Fixture Owner");
    expect(loaded.text).toContain("Data request");
    expect(loaded.text).toContain("Your name");
    expect(loaded.widgetHeight).toBeGreaterThan(200);

    const navigated = await browser.newPage();
    await navigated.goto(`http://127.0.0.1:${port}/client`, { waitUntil: "networkidle0" });
    const beforeClick = await read(navigated);
    expect(beforeClick.defined).toBe(false);
    expect(beforeClick.booted).toBe(true);
    await navigated.click("#open");
    await navigated.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return (window.__booted === true) && (root?.textContent?.includes("Fixture Owner") ?? false);
    }, { timeout: 10000 });
    await shot(navigated, "fixture_dashboard_preview_client");
    const mounted = await read(navigated);
    expect(mounted.defined).toBe(true);
    expect(mounted.booted).toBe(true);
    expect(mounted.text).toContain("Send a shortmail to Fixture Owner");
    expect(mounted.widgetHeight).toBeGreaterThan(200);
    expect(calls.some((call) => call.includes("/api/send/") || call.includes("/api/verify/"))).toBe(false);

    await browser.close();
  }, 30000);
});

declare global {
  interface Window {
    __booted?: boolean;
  }
}
