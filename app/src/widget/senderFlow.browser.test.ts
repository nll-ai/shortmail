import { createServer, type Server } from "node:http";
import { once } from "node:events";
import esbuild from "esbuild";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  confirmTransition,
  emailLooksValid,
  pollStatus,
  randomUrlToken,
  sessionAllowsSend,
  sha256Hex,
  type ProofRow,
  LINK_TTL_MS,
  SESSION_TTL_MS,
} from "../../convex/lib/senderProof";

const require = createRequire("/tmp/sm-audit/package.json");
const puppeteer = require("puppeteer-core") as {
  launch: (options: { executablePath: string; headless: string; args: string[] }) => Promise<{
    newPage: () => Promise<BrowserPage>;
    close: () => Promise<void>;
  }>;
};

type BrowserPage = {
  goto: (url: string, options?: { waitUntil: "networkidle0" }) => Promise<unknown>;
  screenshot: (options: { path: string }) => Promise<unknown>;
  close: () => Promise<void>;
  waitForSelector: (selector: string) => Promise<unknown>;
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
  // The callbacks run in the browser. Their arguments are serialized.
  evaluate: (fn: (...args: string[]) => unknown, ...args: string[]) => Promise<unknown>;
};

type Row = ProofRow & { token: string };

describe("widget verification in the browser", () => {
  let api: Server;
  let originA: Server;
  let originB: Server;
  let apiOrigin = "";
  const rows: Row[] = [];
  const sends: string[] = [];
  let lastToken = "";

  beforeAll(async () => {
    api = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        });
        res.end();
        return;
      }
      if (url.pathname === "/api/embed/demo/config") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({
          vanityName: "demo",
          displayName: "Dr. Nkechi Adeyemi",
          headings: ["Data request"],
          faqs: [],
          isPaid: false,
          theme: null,
          embedAllowedOrigins: [],
        }));
        return;
      }
      if (url.pathname === "/api/collect/demo") {
        res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
        res.end();
        return;
      }
      const body = await readBody(req);
      const json = body.startsWith("{")
        ? JSON.parse(body) as Record<string, string>
        : Object.fromEntries(new URLSearchParams(body));
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/api/verify/start") {
        const token = randomUrlToken();
        lastToken = token;
        const now = Date.now();
        if (emailLooksValid(json.email)) {
          rows.push({
            challengeId: json.challengeId,
            emailHash: await sha256Hex(json.email),
            challengeSecretHash: json.challengeSecretHash,
            sessionSecretHash: json.sessionSecretHash,
            verifyTokenHash: await sha256Hex(token),
            token,
            createdAt: now,
            linkExpiresAt: now + LINK_TTL_MS,
            confirmedAt: null,
            sessionExpiresAt: null,
          });
        }
        res.end(JSON.stringify({ status: "accepted" }));
        return;
      }
      if (url.pathname === "/api/verify/poll") {
        const secretHash = await sha256Hex(json.challengeSecret);
        const row = rows.find((item) => item.challengeId === json.challengeId) ?? null;
        res.end(JSON.stringify({ status: pollStatus(row, secretHash, Date.now()) }));
        return;
      }
      if (url.pathname === "/api/verify/confirm") {
        const tokenHash = await sha256Hex(json.token.trim());
        const secretHash = await sha256Hex(json.challengeSecret);
        const index = rows.findIndex((item) => item.verifyTokenHash === tokenHash);
        const result = confirmTransition(index >= 0 ? rows[index] : null, tokenHash, secretHash, Date.now());
        if (result.ok && index >= 0) rows[index] = { ...rows[index], ...result.row };
        res.end(JSON.stringify({
          status: result.ok ? "confirmed" : result.reason,
          sessionExpiresAt: result.ok ? result.row.sessionExpiresAt : null,
        }));
        return;
      }
      if (url.pathname === "/api/send/demo" && req.method === "POST") {
        const fields = new URLSearchParams(body);
        const email = fields.get("sender_email") ?? "";
        const secret = fields.get("session_secret") ?? "";
        const emailHash = await sha256Hex(email.trim().toLowerCase());
        const secretHash = await sha256Hex(secret);
        const row = rows.find((item) => item.sessionSecretHash === secretHash) ?? null;
        if (!sessionAllowsSend(row, emailHash, secretHash, Date.now())) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: "email_unverified" }));
          return;
        }
        sends.push(fields.get("message") ?? "");
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    api.listen(0, "127.0.0.1");
    await once(api, "listening");
    const address = api.address();
    if (!address || typeof address === "string") throw new Error("no port");
    apiOrigin = `http://127.0.0.1:${address.port}`;

    await esbuild.build({
      entryPoints: ["src/widget/shortmail-widget.ts"],
      bundle: true,
      format: "iife",
      outfile: "/tmp/shortmail-widget-mock.js",
      define: {
        "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(apiOrigin),
      },
    });

    const page = `<!doctype html><script src="/widget.js"></script><shortmail-widget vanity="demo"></shortmail-widget>`;
    const verifyPage = `<!doctype html><body style="margin:0;background:#fff;color:#171717;font-family:Geist,Arial,sans-serif"><header style="border-bottom:1px solid #e5e5e5"><div style="max-width:42rem;margin:0 auto;padding:1rem 1.5rem;font-size:14px;font-weight:700">ShortMail</div></header><main style="max-width:42rem;margin:0 auto;padding:3.5rem 1.5rem"><h1 style="font-size:36px;line-height:1.2;margin:0">Copy your code</h1><p style="color:#525252;font-size:18px;line-height:1.55">Return to the ShortMail form where you wrote the letter, paste this code, and press Confirm email. This page does not send the letter.</p><p id="code" style="border:1px solid #d4d4d4;padding:0.5rem 0.75rem;font-size:14px;word-break:break-all"></p></main><script>const hash=location.hash;document.getElementById("code").textContent=hash.startsWith("#t=")?decodeURIComponent(hash.slice(3)):"Open the confirmation link from your email.";</script></body>`;
    const serve = (widgetPath: string) => createServer((req, res) => {
      if (req.url?.startsWith("/widget.js")) {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(require("node:fs").readFileSync(widgetPath));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(req.url?.startsWith("/verify") ? verifyPage : page);
    });
    originA = serve("/tmp/shortmail-widget-mock.js");
    originB = serve("/tmp/shortmail-widget-mock.js");
    originA.listen(0, "127.0.0.1");
    originB.listen(0, "127.0.0.1");
    await Promise.all([once(originA, "listening"), once(originB, "listening")]);
  }, 20000);

  afterAll(async () => {
    api.close();
    originA.close();
    originB.close();
  });

  it("confirms in the original tab, sends only after that, and does not share the proof", async () => {
    const browser = await puppeteer.launch({
      executablePath: "/usr/local/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const pageA = await browser.newPage();
    const portA = (originA.address() as { port: number }).port;
    const portB = (originB.address() as { port: number }).port;
    await pageA.goto(`http://127.0.0.1:${portA}/`, { waitUntil: "networkidle0" });
    await fill(pageA, "Ada Lovelace", "ada@example.com", "Please send the figure data.");
    await clickShadow(pageA, "Email me a confirmation code");
    for (let attempt = 0; attempt < 50 && !lastToken; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(lastToken.length).toBeGreaterThan(20);
    await pageA.screenshot({ path: "/opt/cursor/artifacts/verify_ux_check_email.png" });
    const codePage = await browser.newPage();
    await codePage.goto(`http://127.0.0.1:${portA}/verify#t=${encodeURIComponent(lastToken)}`);
    await codePage.screenshot({ path: "/opt/cursor/artifacts/verify_ux_code_page.png" });
    await codePage.close();
    await setShadowValue(pageA, "Paste the code from your email", "not-the-code");
    await clickShadow(pageA, "Confirm email");
    await pageA.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("not valid") ?? false;
    });
    expect(sends).toHaveLength(0);

    await setShadowValue(pageA, "Paste the code from your email", lastToken);
    await clickShadow(pageA, "Confirm email");
    await pageA.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("Nothing is sent until you do") ?? false;
    });
    await pageA.screenshot({ path: "/opt/cursor/artifacts/verify_ux_ready_to_send.png" });
    expect(sends).toHaveLength(0);
    await clickShadow(pageA, "Send shortmail");
    await pageA.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("Message sent") ?? false;
    });
    expect(sends).toEqual(["Please send the figure data."]);

    const pageA2 = await browser.newPage();
    await pageA2.goto(`http://127.0.0.1:${portA}/`, { waitUntil: "networkidle0" });
    await fill(pageA2, "Ada Lovelace", "ada@example.com", "A second letter.");
    await clickShadow(pageA2, "Send shortmail");
    await pageA2.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("Message sent") ?? false;
    });
    expect(sends).toEqual(["Please send the figure data.", "A second letter."]);
    expect(rows.filter((row) => row.confirmedAt !== null)).toHaveLength(1);

    const pageB = await browser.newPage();
    await pageB.goto(`http://127.0.0.1:${portB}/`, { waitUntil: "networkidle0" });
    await fill(pageB, "Ada Lovelace", "ada@example.com", "From another site.");
    await clickShadow(pageB, "Send shortmail");
    await pageB.waitForFunction(() => {
      const root = document.querySelector("shortmail-widget")?.shadowRoot;
      return root?.textContent?.includes("Check your email") ?? false;
    });
    expect(sends).toHaveLength(2);
    await browser.close();
    expect(SESSION_TTL_MS).toBeGreaterThan(0);
  }, 30000);
});

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function fill(page: BrowserPage, name: string, email: string, message: string): Promise<void> {
  await page.waitForSelector("shortmail-widget");
  await page.evaluate((name, email, message) => {
    const root = document.querySelector("shortmail-widget")?.shadowRoot;
    if (!root) throw new Error("no shadow");
    const inputs = [...root.querySelectorAll("input")];
    const textInputs = inputs.filter((input) => input.tabIndex !== -1 && input.placeholder !== "Paste the code from your email" && input.placeholder !== "Your own subject");
    const set = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set(textInputs[0], name);
    set(textInputs[1], email);
    const select = root.querySelector("select");
    if (!select) throw new Error("no select");
    set(select, "Data request");
    const area = root.querySelector("textarea");
    if (!area) throw new Error("no message");
    set(area, message);
  }, name, email, message);
}

async function clickShadow(page: BrowserPage, label: string): Promise<void> {
  await page.evaluate((label) => {
    const root = document.querySelector("shortmail-widget")?.shadowRoot;
    const button = [...root?.querySelectorAll("button") ?? []].find((item) => item.textContent === label);
    button?.click();
  }, label);
}

async function setShadowValue(page: BrowserPage, placeholder: string, value: string): Promise<void> {
  await page.evaluate((placeholder, value) => {
    const root = document.querySelector("shortmail-widget")?.shadowRoot;
    const input = root?.querySelector(`input[placeholder="${placeholder}"]`) as HTMLInputElement | null;
    if (!input) throw new Error(placeholder);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, placeholder, value);
}
