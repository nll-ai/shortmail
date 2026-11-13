import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "@tailwindcss/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LandingHome } from "../src/components/landing/LandingHome";
import { LANDING_PRIVACY_PARAGRAPH } from "../src/app/landing/privacy";
import { CHROME_EXECUTABLE, puppeteer } from "../src/test/puppeteer";

const FORBIDDEN = ["/api/send", "/api/embed", "/api/collect", "api.resend.com"];

type Browser = Awaited<ReturnType<typeof puppeteer.launch>>;

function landingDocument(foundingEligible: boolean, css: string): string {
  const inner = renderToStaticMarkup(
    createElement(LandingHome, { foundingEligible }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><style>${css}</style></head><body class="antialiased">${inner}</body></html>`;
}

describe("landing page (e2e)", () => {
  let server: Server;
  let origin = "";
  let browser: Browser;
  let css = "";

  beforeAll(async () => {
    const globals = readFileSync(
      new URL("../src/app/globals.css", import.meta.url),
      "utf8",
    );
    const compiled = await compile(globals, {
      base: new URL("..", import.meta.url).pathname,
      onDependency: () => undefined,
    });
    const markup = landingDocument(false, "");
    const used = new Set<string>(["antialiased"]);
    for (const match of markup.matchAll(/class="([^"]*)"/g)) {
      for (const token of match[1].split(/\s+/)) {
        if (token) used.add(token);
      }
    }
    css = `${globals}\n${compiled.build([...used])}`;

    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", origin);
      if (FORBIDDEN.some((part) => url.pathname.includes(part))) {
        res.writeHead(500);
        res.end("forbidden");
        return;
      }
      if (url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(landingDocument(false, css));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    origin = `http://127.0.0.1:${addr.port}`;

    browser = await puppeteer.launch({
      executablePath: CHROME_EXECUTABLE,
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  });

  afterAll(async () => {
    await browser.close();
    server.close();
  });

  async function assertNoHorizontalOverflow(width: number, height: number) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`${origin}/`, { waitUntil: "networkidle0" });
    const overflow = (await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    })) as boolean;
    await page.close();
    expect(overflow).toBe(false);
  }

  async function ctaInFirstViewport(width: number, height: number) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`${origin}/`, { waitUntil: "networkidle0" });
    const inView = (await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find(
        (node) => node.textContent?.trim() === "Create your page",
      );
      if (!link) return false;
      const rect = link.getBoundingClientRect();
      return rect.bottom > 0 && rect.bottom <= window.innerHeight;
    })) as boolean;
    await page.close();
    expect(inView).toBe(true);
  }

  it("renders the privacy paragraph and FAQ", async () => {
    const page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: "networkidle0" });
    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    expect(text).toContain(LANDING_PRIVACY_PARAGRAPH);
    expect(text).toContain("Will this stop all my email?");
    expect(text).toContain("allowlist of up to 20 sites");
  });

  it("keeps Create your page in the first viewport", async () => {
    await ctaInFirstViewport(390, 844);
    await ctaInFirstViewport(1440, 900);
  });

  it("avoids horizontal overflow at 320, 390, and 1440", async () => {
    await assertNoHorizontalOverflow(320, 700);
    await assertNoHorizontalOverflow(390, 844);
    await assertNoHorizontalOverflow(1440, 900);
  });

  it("shows a visible focus outline on the account links", async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${origin}/`, { waitUntil: "networkidle0" });
    const outlineOk = (await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find(
        (node) => node.textContent?.trim() === "Sign in",
      );
      if (!link) return false;
      link.focus();
      const style = getComputedStyle(link);
      const width = Number.parseFloat(style.outlineWidth || "0");
      return style.outlineStyle !== "none" && width >= 2;
    })) as boolean;
    await page.close();
    expect(outlineOk).toBe(true);
  });
});
