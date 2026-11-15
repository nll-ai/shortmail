import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHROME_EXECUTABLE, puppeteer } from "../test/puppeteer";
import { compile } from "@tailwindcss/node";

const buttonSource = readFileSync(new URL("./SignOutButton.tsx", import.meta.url), "utf8");
const classMatch = buttonSource.match(/SIGN_OUT_BUTTON_CLASS =\n  "([^"]+)"/);
if (!classMatch) throw new Error("sign-out button class missing");
const SIGN_OUT_BUTTON_CLASS = classMatch[1];

type BrowserPage = {
  goto: (url: string, options?: { waitUntil: "networkidle0" }) => Promise<unknown>;
  setViewport: (viewport: { width: number; height: number }) => Promise<unknown>;
  setContent: (html: string, options?: { waitUntil: "networkidle0" }) => Promise<unknown>;
  screenshot: (options: { path: string }) => Promise<unknown>;
  emulateMediaFeatures: (features: { name: string; value: string }[]) => Promise<unknown>;
  evaluate: (fn: () => unknown) => Promise<unknown>;
};

type Measured = {
  color: string;
  background: string;
  height: number;
  outline: string;
};

/**
 * Relative luminance contrast for an rgb() string pair.
 *
 * :param left: CSS rgb color.
 * :param right: CSS rgb color.
 * :returns: WCAG contrast ratio.
 */
function contrast(left: string, right: string): number {
  const lum = (value: string): number => {
    const parts = value.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = parts.map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(lum(left), lum(right));
  const darker = Math.min(lum(left), lum(right));
  return (lighter + 0.05) / (darker + 0.05);
}

const pageHtml = (css: string) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
<p style="margin:0;padding:.5rem 1rem;font-size:12px;letter-spacing:.04em">FIXTURE — full dashboard stylesheet, not an authenticated session</p>
<main class="mx-auto max-w-6xl p-8">
  <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div>
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <p class="mt-2">Signed in as <strong>ericmajinglong@gmail.com</strong></p>
    </div>
    <form><button id="sign-out" type="submit" class="${SIGN_OUT_BUTTON_CLASS}">Sign out</button></form>
  </div>
  <section class="border p-4 text-sm">
    <h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Your send page</h2>
    <p>Visitors write to you at <span class="font-mono underline">/send/fixture</span></p>
    <p class="mt-2 text-xs text-muted">Custom vanity names are a paid-account feature.</p>
  </section>
</main>
</body></html>`;

describe("sign-out contrast on the dashboard stylesheet", () => {
  it("stays readable in light and dark mode", async () => {
    const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const compiled = await compile(globals, {
      base: new URL("../..", import.meta.url).pathname,
      onDependency: () => undefined,
    });
    const utilities = compiled.build([
      ...SIGN_OUT_BUTTON_CLASS.split(/\s+/),
      "mx-auto",
      "max-w-6xl",
      "p-8",
      "mb-4",
      "flex",
      "flex-wrap",
      "items-center",
      "justify-between",
      "gap-x-4",
      "gap-y-2",
      "text-2xl",
      "font-bold",
      "mt-2",
      "border",
      "p-4",
      "text-sm",
      "mb-3",
      "text-xs",
      "uppercase",
      "tracking-[0.2em]",
      "font-mono",
      "underline",
      "text-muted",
    ]);
    const css = `${globals}\n${utilities}`;
    const server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(pageHtml(css));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const browser = await puppeteer.launch({
      executablePath: CHROME_EXECUTABLE,
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    const measure = async (scheme: "light" | "dark", width: number, stem: string) => {
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      await page.setViewport({ width, height: width < 800 ? 844 : 900 });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0" });
      const measured = await page.evaluate(() => {
        const button = document.getElementById("sign-out");
        const buttonStyle = getComputedStyle(button!);
        const bodyStyle = getComputedStyle(document.body);
        return {
          color: buttonStyle.color,
          background: bodyStyle.backgroundColor,
          height: button!.getBoundingClientRect().height,
          outline: buttonStyle.outlineColor,
        };
      }) as Measured;
      await page.screenshot({ path: `/opt/cursor/artifacts/signout_dashboard_${scheme}_${stem}.png` });
      expect(contrast(measured.color, measured.background), scheme).toBeGreaterThan(4.5);
      expect(measured.height, scheme).toBeGreaterThanOrEqual(44);
      return measured;
    };
    const darkMobile = await measure("dark", 390, "mobile");
    const darkDesktop = await measure("dark", 1440, "desktop");
    const lightMobile = await measure("light", 390, "mobile");
    const lightDesktop = await measure("light", 1440, "desktop");
    expect(darkMobile.color).not.toBe(lightMobile.color);
    expect(darkDesktop.background).not.toBe(lightDesktop.background);
    await browser.close();
    server.close();
  }, 30000);
});
