import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { compile } from "@tailwindcss/node";
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
  emulateMediaFeatures: (features: { name: string; value: string }[]) => Promise<unknown>;
  click: (selector: string) => Promise<unknown>;
  waitForFunction: (
    fn: (...args: string[]) => boolean,
    options?: { timeout: number },
    ...args: string[]
  ) => Promise<unknown>;
  evaluate: (fn: (...args: string[]) => unknown, ...args: string[]) => Promise<unknown>;
};

type FaqView = {
  text: string;
  html: string;
  questions: string[];
  linkHrefs: string[];
  faqColor: string;
  faqCursor: string;
  faqSize: string;
};

const LABEL = "FIXTURE — local widget preview, not a signed-in dashboard. No account write. No email.";
const QUESTION = "Can I find time with you to chat?";
const ANSWER = "Yes, please use Calendly: https://calendly.com/ericmjl/45-minute-meeting.";
const ADDED = "Do you read every letter?";
const RENAMED = "Can we talk this week?";

const CLASSES = [
  "bg-neutral-900", "px-4", "py-2", "text-xs", "tracking-wide", "text-white",
  "mx-auto", "max-w-6xl", "p-8", "text-2xl", "font-bold", "mt-2", "text-sm",
  "mt-6", "grid", "grid-cols-1", "gap-8", "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]",
  "min-w-0", "space-y-8", "border", "p-4", "mb-3", "font-bold", "uppercase",
  "tracking-[0.2em]", "space-y-3", "flex", "items-center", "justify-between",
  "gap-2", "font-medium", "text-link", "hover:underline", "text-danger",
  "whitespace-pre-wrap", "text-muted", "space-y-2",
  "border-accent", "bg-accent", "text-accent-foreground", "px-4", "py-2", "tracking-[0.14em]",
  "space-y-4", "self-start", "lg:sticky", "lg:top-6", "uppercase",
  "tracking-wide", "border-line", "bg-background", "text-foreground", "p-6",
];

function dashboardHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style id="skin"></style>
<script src="/widget.js" defer></script>
</head><body>
<p class="bg-neutral-900 px-4 py-2 text-xs tracking-wide text-white">${LABEL}</p>
<main class="mx-auto max-w-6xl p-8">
  <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
  <p class="mt-2 text-sm">Fixture owner. This page is not signed in.</p>
  <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
    <div class="min-w-0 space-y-8">
      <section class="border p-4 text-sm">
        <h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
        <ul class="mb-3 space-y-3">
          <li>
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">${QUESTION}</span>
              <span class="flex gap-2">
                <button type="button" id="rename-faq" class="text-xs text-link hover:underline">rename question</button>
                <button type="button" id="remove-added" class="text-xs text-danger hover:underline">remove added</button>
              </span>
            </div>
            <p class="whitespace-pre-wrap text-muted">${ANSWER}</p>
          </li>
        </ul>
        <form id="add-form" class="space-y-2">
          <p class="text-xs text-muted">Fixture control. It only tells the preview what changed. It does not save and it does not send mail.</p>
          <button type="submit" id="add-faq" class="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">Add FAQ</button>
        </form>
      </section>
    </div>
    <div class="space-y-4 self-start lg:sticky lg:top-6">
      <p class="text-xs uppercase tracking-wide text-muted">Live preview — what your visitors see</p>
      <div id="frame" class="border border-line bg-background p-6">
        <shortmail-widget vanity="fixture"></shortmail-widget>
      </div>
    </div>
  </div>
</main>
<script>
  const EVENT = "shortmail-widget:change";
  const send = (detail) => window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  document.getElementById("add-form").addEventListener("submit", (event) => {
    event.preventDefault();
    send({
      kind: "faq-added",
      question: ${JSON.stringify(ADDED)},
      answer: "See <" + "script>alert(1)<" + "/script> [click](javascript:alert(1)) https://evil.example",
    });
  });
  document.getElementById("rename-faq").addEventListener("click", () => {
    send({
      kind: "faq-edited",
      previousQuestion: ${JSON.stringify(QUESTION)},
      question: ${JSON.stringify(RENAMED)},
      answer: ${JSON.stringify(ANSWER)},
    });
  });
  document.getElementById("remove-added").addEventListener("click", () => {
    send({ kind: "faq-removed", question: ${JSON.stringify(ADDED)} });
  });
</script>
</body></html>`;
}

function readFaqs(page: BrowserPage): Promise<FaqView> {
  return page.evaluate(() => {
    const root = document.querySelector("shortmail-widget")?.shadowRoot;
    const questions = [...(root?.querySelectorAll(".sm-faq-question") ?? [])];
    const answer = root?.querySelector(".sm-faq-answer") as HTMLElement | undefined;
    const style = answer ? getComputedStyle(answer) : null;
    const link = root?.querySelector(".sm-faq-answer a") as HTMLElement | undefined;
    const linkStyle = link ? getComputedStyle(link) : null;
    return {
      text: root?.textContent ?? "",
      html: root?.innerHTML ?? "",
      questions: questions.map((node) => node.textContent ?? ""),
      linkHrefs: [...(root?.querySelectorAll("a") ?? [])].map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
      faqColor: style?.color ?? "",
      faqCursor: linkStyle?.cursor ?? "",
      faqSize: style?.fontSize ?? "",
    };
  }) as Promise<FaqView>;
}

describe("dashboard FAQ preview matches the visitor widget", () => {
  let api: Server;
  let origin: Server;
  const calls: string[] = [];
  let originPort = 0;

  beforeAll(async () => {
    api = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      calls.push(`${req.method} ${url.pathname}`);
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        });
        res.end();
        return;
      }
      if (url.pathname === "/api/embed/fixture/config") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          vanityName: "fixture",
          displayName: "Fixture Owner",
          headings: ["Data request"],
          faqs: [{ question: QUESTION, answer: ANSWER }],
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

    await esbuild.build({
      entryPoints: ["src/widget/shortmail-widget.ts"],
      bundle: true,
      format: "iife",
      outfile: "/tmp/shortmail-widget-faq.js",
      define: {
        "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(`http://127.0.0.1:${address.port}`),
      },
    });

    const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const compiled = await compile(globals, {
      base: new URL("../../..", import.meta.url).pathname,
      onDependency: () => undefined,
    });
    const css = `${globals}\n${compiled.build(CLASSES)}`;
    const html = dashboardHtml().replace('<style id="skin"></style>', `<style id="skin">${css}</style>`);
    origin = createServer((req, res) => {
      if (req.url?.startsWith("/widget.js")) {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(readFileSync("/tmp/shortmail-widget-faq.js"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    origin.listen(0, "127.0.0.1");
    await once(origin, "listening");
    originPort = (origin.address() as { port: number }).port;
  }, 30000);

  afterAll(() => {
    api.close();
    origin.close();
  });

  it("shows the visitor question and safe answer link, and applies add, rename, and remove", async () => {
    const browser = await puppeteer.launch({
      executablePath: "/usr/local/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    const open = async (scheme: "light" | "dark", width: number) => {
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      await page.setViewport({ width, height: width < 800 ? 844 : 1000 });
      await page.goto(`http://127.0.0.1:${originPort}/`, { waitUntil: "networkidle0" });
      await page.waitForFunction((question: string) => {
        const text = document.querySelector("shortmail-widget")?.shadowRoot?.textContent ?? "";
        return text.includes(question) && text.includes("Fixture Owner");
      }, { timeout: 10000 }, QUESTION);
    };

    await open("light", 1440);
    const initial = await readFaqs(page);
    expect(initial.text).toContain(QUESTION);
    expect(initial.text).toContain("Send a shortmail to Fixture Owner");
    expect(initial.text).toContain("Your name");
    expect(initial.linkHrefs).toEqual(["https://calendly.com/ericmjl/45-minute-meeting"]);
    expect(initial.html).not.toContain("<script");
    expect(initial.faqColor).toBe("rgb(82, 82, 82)");
    expect(initial.faqCursor).toBe("pointer");
    expect(initial.faqSize).toBe("14px");
    expect(initial.text.indexOf(QUESTION)).toBeLessThan(initial.text.indexOf("Your name"));

    await page.evaluate(() => {
      const faq = document.querySelector("shortmail-widget")?.shadowRoot?.querySelector(".sm-faq");
      if (faq instanceof HTMLElement) faq.click();
    });
    const afterClick = await readFaqs(page);
    expect(afterClick.linkHrefs).toEqual(["https://calendly.com/ericmjl/45-minute-meeting"]);
    expect(afterClick.questions).toEqual([QUESTION]);

    const shot = async (scheme: "light" | "dark", width: number, stem: string) => {
      await open(scheme, width);
      await page.screenshot({
        path: `/opt/cursor/artifacts/fixture_faq_preview_${stem}.png`,
        fullPage: true,
      });
    };
    await shot("light", 1440, "desktop_light");
    await shot("dark", 1440, "desktop_dark");
    await shot("light", 390, "mobile_light");
    await shot("dark", 390, "mobile_dark");

    await open("light", 1440);
    await page.click("#add-faq");
    await page.waitForFunction((question: string) => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return [...(root?.querySelectorAll(".sm-faq-question") ?? [])].some((node) => node.textContent === question);
    }, { timeout: 5000 }, ADDED);
    const added = await readFaqs(page);
    expect(added.questions).toEqual([QUESTION, ADDED]);
    expect(added.linkHrefs).toContain("https://calendly.com/ericmjl/45-minute-meeting");
    expect(added.linkHrefs).toContain("https://evil.example/");
    expect(added.html).not.toContain("<script");
    expect(added.html).not.toContain("javascript:");
    expect(added.text.indexOf(ADDED)).toBeLessThan(added.text.indexOf("Your name"));
    await page.screenshot({
      path: "/opt/cursor/artifacts/fixture_faq_preview_after_add_desktop_light.png",
      fullPage: true,
    });

    await page.click("#rename-faq");
    await page.waitForFunction((question: string) => {
      const text = document.querySelector("shortmail-widget")?.shadowRoot?.textContent ?? "";
      return text.includes(question);
    }, { timeout: 5000 }, RENAMED);
    const renamed = await readFaqs(page);
    expect(renamed.questions).toEqual([RENAMED, ADDED]);
    expect(renamed.linkHrefs).toContain("https://calendly.com/ericmjl/45-minute-meeting");

    await page.click("#remove-added");
    await page.waitForFunction((question: string) => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      const questions = [...(root?.querySelectorAll(".sm-faq-question") ?? [])].map((node) => node.textContent);
      return !questions.includes(question);
    }, { timeout: 5000 }, ADDED);
    const removed = await readFaqs(page);
    expect(removed.questions).toEqual([RENAMED]);

    await page.evaluate((question: string) => {
      window.dispatchEvent(new CustomEvent("shortmail-widget:change", {
        detail: { kind: "faq-removed", question },
      }));
    }, RENAMED);
    await page.evaluate((question: string) => {
      window.dispatchEvent(new CustomEvent("shortmail-widget:change", {
        detail: {
          kind: "faq-added",
          question,
          answer: "https://calendly.com/ericmjl/45-minute-meeting",
        },
      }));
    }, "Is the link public?");
    await page.waitForFunction((question: string) => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.querySelector(".sm-faqs") !== null
        && [...(root?.querySelectorAll(".sm-faq-question") ?? [])].some((node) => node.textContent === question);
    }, { timeout: 5000 }, "Is the link public?");
    const readded = await readFaqs(page);
    expect(readded.questions).toEqual(["Is the link public?"]);
    expect(readded.linkHrefs).toEqual(["https://calendly.com/ericmjl/45-minute-meeting"]);
    expect(readded.text.indexOf("Is the link public?")).toBeLessThan(readded.text.indexOf("Your name"));

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("shortmail-widget:change", {
        detail: { kind: "display-name", value: "Renamed Owner" },
      }));
    });
    await page.waitForFunction(() => {
      const text = document.querySelector("shortmail-widget")?.shadowRoot?.textContent ?? "";
      return text.includes("Send a shortmail to Renamed Owner");
    }, { timeout: 5000 });

    expect(calls.some((call) => call.includes("/api/embed/fixture/config"))).toBe(true);
    expect(calls.some((call) => call.includes("/api/send/") || call.includes("/api/verify/"))).toBe(false);
    await browser.close();
  }, 60000);
});
