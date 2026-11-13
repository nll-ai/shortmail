import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { compile } from "@tailwindcss/node";
import { planReorder, sortByOrder, type OwnedItem } from "../convex/lib/order";

const QUESTION = "Can I find time with you to chat?";
const ANSWER =
  "Yes, please use Calendly: https://calendly.com/ericmjl/45-minute-meeting.";
const LABEL =
  "FIXTURE — real widget.js, mocked config. Not a signed-in account. No Convex write. No email.";
const REORDER_LABEL =
  "FIXTURE — local reorder harness. Not the Vercel preview. Not a signed-in account. No email.";
const BILLING_LABEL =
  "FIXTURE — mocked Stripe checkout. Not a signed-in account. No Convex write. No real payment.";
const ADMIN_BILLING_LABEL =
  "FIXTURE — admin comp UI (static). Not signed in. No Convex write. No Stripe.";

const CLASSES = [
  "bg-neutral-900", "px-4", "py-2", "text-xs", "tracking-wide", "text-white",
  "mx-auto", "max-w-6xl", "max-w-lg", "p-8", "p-6", "text-2xl", "font-bold",
  "mt-2", "text-sm", "mt-6", "grid", "grid-cols-1", "gap-8",
  "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]", "min-w-0", "space-y-8",
  "border", "p-4", "mb-3", "uppercase", "tracking-[0.2em]", "space-y-3",
  "flex", "items-center", "justify-between", "gap-2", "font-medium",
  "text-link", "text-danger", "whitespace-pre-wrap", "text-muted",
  "space-y-2", "border-accent", "bg-accent", "text-accent-foreground", "tracking-[0.14em]",
  "space-y-4", "self-start", "border-line", "bg-background", "text-foreground", "w-full",
  "border-b", "border-input", "bg-transparent", "text-foreground", "px-1", "py-1",
  "min-h-20",
];

type Faq = { question: string; answer: string };

const configs: Record<
  string,
  {
    displayName: string;
    headings: string[];
    faqs: Faq[];
    theme: { preset: string; customCss: string | null } | null;
  }
> = {
  fixture: {
    displayName: "Fixture Owner",
    headings: ["Data request"],
    faqs: [{ question: QUESTION, answer: ANSWER }],
    theme: null,
  },
  unsafe: {
    displayName: "Fixture Owner",
    headings: [],
    faqs: [
      {
        question: "<img src=x onerror=alert(1)>",
        answer:
          'See <script>alert(1)</script> <img src=x onerror=alert(1)> [click](javascript:alert(1)) [blob](data:text/html,hi) [ok](https://calendly.com/ericmjl/45-minute-meeting)',
      },
    ],
    theme: null,
  },
  midnight: {
    displayName: "Midnight Owner",
    headings: ["Data request"],
    faqs: [{ question: QUESTION, answer: ANSWER }],
    theme: { preset: "midnight", customCss: null },
  },
  paper: {
    displayName: "Paper Owner",
    headings: ["Data request"],
    faqs: [{ question: QUESTION, answer: ANSWER }],
    theme: { preset: "paper", customCss: null },
  },
  custom: {
    displayName: "Custom Owner",
    headings: ["Data request"],
    faqs: [{ question: QUESTION, answer: ANSWER }],
    theme: { preset: "default", customCss: "button { letter-spacing: 0.2em; }" },
  },
};

const calls: string[] = [];
const sends: Record<string, string>[] = [];

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function page(body: string, css: string, scripts: string[], label = LABEL): string {
  const tags = scripts.map((src) => `<script src="${src}" defer></script>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${tags}</head><body><p class="bg-neutral-900 px-4 py-2 text-xs tracking-wide text-white">${label}</p>${body}</body></html>`;
}

function dashboard(css: string): string {
  return page(
    `<main class="mx-auto max-w-6xl p-8">
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <p class="mt-2 text-sm">Fixture owner. This page is not signed in.</p>
      <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section class="min-w-0 space-y-8 border p-4 text-sm">
          <h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
          <ul id="faq-list" class="mb-3 space-y-3">
            <li class="font-medium">${QUESTION}</li>
          </ul>
          <p class="whitespace-pre-wrap text-muted">${ANSWER}</p>
          <p class="text-xs text-muted">Add, edit, and remove call the real preview event. They do not save and they do not send mail.</p>
          <p id="external-status" class="text-xs text-muted"></p>
          <form id="add-form" class="space-y-2">
            <input id="previous" class="w-full border-0 border-b border-input bg-transparent px-1 py-1 text-sm text-foreground" value="${QUESTION}" />
            <input id="question" class="w-full border-0 border-b border-input bg-transparent px-1 py-1 text-sm text-foreground" value="${QUESTION}" />
            <textarea id="answer" class="w-full min-h-20 border-0 border-b border-input bg-transparent px-1 py-1 text-sm text-foreground">${ANSWER}</textarea>
            <button id="add-faq" type="submit" class="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">Add FAQ</button>
            <button id="save-edit" type="button" class="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">Save edit</button>
            <button id="remove-faq" type="button" class="text-xs text-danger">Remove</button>
            <button id="external-change" type="button" class="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">Simulate external change</button>
          </form>
        </section>
        <div class="space-y-4 self-start">
          <p class="text-xs uppercase tracking-wide text-muted">Live preview — what your visitors see</p>
          <div id="frame" class="border border-line bg-background p-6">
            <shortmail-widget vanity="fixture"></shortmail-widget>
          </div>
        </div>
      </div>
    </main>`,
    css,
    ["/widget.js", "/harness.js"],
  );
}

function billingFree(css: string): string {
  return page(
    `<main class="mx-auto max-w-lg p-8 text-sm">
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <div class="mt-6 border p-4 space-y-2">
        <p class="font-medium text-sm">Upgrade to Premium</p>
        <p class="text-xs text-muted">$48/year billed annually (fixture shows mocked checkout).</p>
        <button id="upgrade-btn" type="button" class="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground">Upgrade to Premium</button>
      </div>
      <script>
        document.getElementById("upgrade-btn").addEventListener("click", async () => {
          const res = await fetch("/api/billing/checkout", { method: "POST" });
          const body = await res.json();
          if (body.url) window.location.href = body.url;
        });
      </script>
    </main>`,
    css,
    [],
    BILLING_LABEL,
  );
}

function billingSuccess(css: string): string {
  return page(
    `<main class="mx-auto max-w-lg p-8 text-sm">
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <p class="mt-4 border px-4 py-3 text-sm">Payment received — Premium unlocked (fixture).</p>
      <div class="mt-6 border p-4 space-y-2">
        <p class="font-medium text-sm">Premium active</p>
        <p class="text-xs text-muted">Analytics, theming, embed, and custom vanity are unlocked.</p>
        <button type="button" class="border px-4 py-2 text-xs">Manage billing</button>
      </div>
    </main>`,
    css,
    [],
    BILLING_LABEL,
  );
}

function billingPremiumActive(css: string): string {
  return page(
    `<main class="mx-auto max-w-lg p-8 text-sm">
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <div class="mt-6 border p-4 space-y-2">
        <p class="font-medium text-sm">Premium active</p>
        <p class="text-xs text-muted">Analytics, theming, embed, and custom vanity are unlocked.</p>
        <button id="manage-billing" type="button" class="border px-4 py-2 text-xs">Manage billing</button>
      </div>
    </main>`,
    css,
    [],
    BILLING_LABEL,
  );
}

function adminUsersFixture(css: string): string {
  return page(
    `<main class="mx-auto min-h-svh max-w-5xl bg-background p-8 text-foreground text-sm">
      <h1 class="text-2xl font-bold mb-4">User management</h1>
      <p class="text-xs text-muted mb-3">Premium comps use Stripe 100% coupons (shortmail_comp_lifetime or shortmail_comp_1yr).</p>
      <label class="flex items-center gap-2 text-sm mb-4" id="comp-kind-label">
        Default comp type:
        <select id="comp-kind-select" class="border border-line bg-background px-2 py-1 text-xs">
          <option value="one_year">Free for one year</option>
          <option value="lifetime">Free for life</option>
        </select>
      </label>
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="text-xs uppercase text-muted">
            <th class="py-1">Email</th>
            <th class="py-1">Vanity</th>
            <th class="py-1">Paid</th>
            <th class="py-1">Comp / period</th>
            <th class="py-1">Premium</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-t">
            <td class="py-2">free@example.com</td>
            <td class="py-2 font-mono text-xs">free-user</td>
            <td class="py-2 text-xs">no</td>
            <td class="py-2 text-xs text-muted">—</td>
            <td class="py-2"><button type="button" class="border border-line px-3 py-0.5 text-xs">Comp Premium</button></td>
          </tr>
          <tr class="border-t">
            <td class="py-2">comp@example.com</td>
            <td class="py-2 font-mono text-xs">comp-user</td>
            <td class="py-2 text-xs">yes</td>
            <td class="py-2 text-xs text-muted">One year (ends)<br>Until Jan 1, 2027</td>
            <td class="py-2"><button type="button" class="border border-line px-3 py-0.5 text-xs" disabled>Subscribed</button></td>
          </tr>
        </tbody>
      </table>
    </main>`,
    css,
    [],
    ADMIN_BILLING_LABEL,
  );
}

function hosted(css: string, vanity: string, label = LABEL): string {
  return page(
    `<main class="mx-auto max-w-lg border border-line bg-background p-6 text-sm text-foreground">
      <shortmail-widget vanity="${vanity}"></shortmail-widget>
    </main>`,
    css,
    ["/widget.js"],
    label,
  );
}

type HeadingRow = OwnedItem & { heading: string };
type FaqRow = OwnedItem & { question: string; answer: string };

function freshLists(): { headings: HeadingRow[]; faqs: FaqRow[] } {
  return {
    headings: [
      { id: "h1", heading: "I'd like you to consult for me", _creationTime: 1 },
      { id: "h2", heading: "I'd like to invite you to give a talk", _creationTime: 2 },
      { id: "h3", heading: "SciPy 2026 Fundraiser", _creationTime: 3 },
    ],
    faqs: [
      { id: "f1", question: QUESTION, answer: ANSWER, _creationTime: 1 },
      {
        id: "f2",
        question: "Do you read every letter?",
        answer: "Yes. Write the letter here: https://example.com/letters",
        _creationTime: 2,
      },
    ],
  };
}

function classTokens(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const tokens: string[] = [];
  for (const match of text.matchAll(/["'`]([^"'`]*)["'`]/g)) {
    for (const token of match[1].split(/\s+/)) {
      if (/^[a-zA-Z0-9:/_![\]%.()-]+$/.test(token) && /[-:[\]/]/.test(token)) tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Serve the real widget bundle and a labeled fixture dashboard.
 *
 * :returns: Origin the Cypress run should visit.
 */
export async function startFaqFixture(): Promise<string> {
  const appRoot = process.cwd();
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const origin = `http://127.0.0.1:${address.port}`;

  const outdir = "/tmp/shortmail-cypress-faq";
  await esbuild.build({
    absWorkingDir: appRoot,
    entryPoints: {
      widget: "src/widget/shortmail-widget.ts",
      harness: "cypress/harness.ts",
      reorder: "cypress/reorder-client.tsx",
    },
    bundle: true,
    format: "iife",
    jsx: "automatic",
    outdir,
    define: {
      "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(origin),
    },
  });
  await esbuild.build({
    absWorkingDir: appRoot,
    entryPoints: ["cypress/theme-render.tsx"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: path.join(outdir, "theme-render.cjs"),
    alias: {
      "next/link": path.join(appRoot, "cypress/link-stub.tsx"),
    },
  });
  const themeMod = createRequire(import.meta.url)(path.join(outdir, "theme-render.cjs")) as {
    themePages: () => Record<string, string>;
  };
  const themes = themeMod.themePages();
  const widgetJs = readFileSync(path.join(outdir, "widget.js"));
  const harnessJs = readFileSync(path.join(outdir, "harness.js"));
  const reorderJs = readFileSync(path.join(outdir, "reorder.js"));
  const globals = readFileSync(path.join(appRoot, "src/app/globals.css"), "utf8");
  const compiled = await compile(globals, {
    base: appRoot,
    onDependency: () => undefined,
  });
  const used = new Set(CLASSES);
  for (const html of Object.values(themes)) {
    for (const match of html.matchAll(/class="([^"]*)"/g)) {
      for (const token of match[1].split(/\s+/)) {
        if (token) used.add(token);
      }
    }
  }
  for (const file of [
    "src/components/dashboard/ReorderRows.tsx",
    "src/theme/controls.ts",
    "cypress/reorder-client.tsx",
  ]) {
    for (const token of classTokens(path.join(appRoot, file))) used.add(token);
  }
  const css = `${globals}\n${compiled.build([...used])}`;
  const dashboardHtml = dashboard(css);
  const billingFreeHtml = billingFree(css);
  const billingSuccessHtml = billingSuccess(css);
  const billingPremiumHtml = billingPremiumActive(css);
  const adminUsersHtml = adminUsersFixture(css);
  const sendHtml = hosted(css, "fixture");
  const unsafeHtml = hosted(css, "unsafe");
  const reorderHtml = page(
    `<div id="reorder-root"></div>`,
    css,
    ["/reorder.js"],
    REORDER_LABEL,
  );
  const reorderSendHtml = hosted(css, "reorder", REORDER_LABEL);
  let lists = freshLists();
  const publicLists = () => ({
    headings: sortByOrder(lists.headings).map(({ id, heading }) => ({ id, heading })),
    faqs: sortByOrder(lists.faqs).map(({ id, question, answer }) => ({ id, question, answer })),
  });

  const respond = (res: import("node:http").ServerResponse, body: string | Buffer, type: string) => {
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  };

  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    void (async () => {
    const url = new URL(req.url ?? "/", origin);
    const body = await readBody(req);
    calls.push(`${req.method} ${url.pathname}`);
    if (req.method === "POST" && url.pathname === "/__reset") {
      calls.length = 0;
      sends.length = 0;
      lists = freshLists();
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/__calls") {
      respond(res, JSON.stringify(calls), "application/json");
      return;
    }
    if (url.pathname === "/__send") {
      respond(res, JSON.stringify(sends), "application/json");
      return;
    }
    if (req.method === "POST" && /^\/api\/send\/(fixture|unsafe)$/.test(url.pathname)) {
      sends.push(Object.fromEntries(new URLSearchParams(body)));
      respond(res, JSON.stringify({ ok: true }), "application/json");
      return;
    }
    if (url.pathname === "/__lists") {
      respond(res, JSON.stringify(publicLists()), "application/json");
      return;
    }
    if (req.method === "POST" && url.pathname === "/__reorder") {
      const payload = JSON.parse(body) as { table?: string; ids?: string[] };
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      if (payload.table === "headings") {
        const ordered = planReorder(lists.headings, ids);
        const byId = new Map(lists.headings.map((row) => [row.id, row]));
        lists.headings = ordered.map((id, position) => ({ ...byId.get(id)!, position }));
      } else if (payload.table === "faqs") {
        const ordered = planReorder(lists.faqs, ids);
        const byId = new Map(lists.faqs.map((row) => [row.id, row]));
        lists.faqs = ordered.map((id, position) => ({ ...byId.get(id)!, position }));
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unknown-table" }));
        return;
      }
      respond(res, JSON.stringify(publicLists()), "application/json");
      return;
    }
    if (url.pathname === "/widget.js") {
      respond(res, widgetJs, "text/javascript");
      return;
    }
    if (url.pathname === "/harness.js") {
      respond(res, harnessJs, "text/javascript");
      return;
    }
    if (url.pathname === "/reorder.js") {
      respond(res, reorderJs, "text/javascript");
      return;
    }
    const embed = url.pathname.match(/^\/api\/embed\/([^/]+)\/config$/);
    if (embed && decodeURIComponent(embed[1]) === "reorder") {
      const view = publicLists();
      respond(
        res,
        JSON.stringify({
          vanityName: "reorder",
          displayName: "Fixture Owner",
          headings: view.headings.map((heading) => heading.heading),
          faqs: view.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
          isPaid: false,
          theme: null,
          embedAllowedOrigins: [],
        }),
        "application/json",
      );
      return;
    }
    if (embed) {
      const spec = configs[decodeURIComponent(embed[1])] ?? null;
      if (!spec) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not-the-fixture" }));
        return;
      }
      respond(
        res,
        JSON.stringify({
          vanityName: decodeURIComponent(embed[1]),
          displayName: spec.displayName,
          headings: spec.headings,
          faqs: spec.faqs,
          isPaid: false,
          theme: spec.theme,
          embedAllowedOrigins: [],
        }),
        "application/json",
      );
      return;
    }
    if (url.pathname === "/api/collect/fixture" || url.pathname === "/api/collect/unsafe") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/api/billing/checkout" && req.method === "POST") {
      respond(res, JSON.stringify({ url: `${origin}/billing/success` }), "application/json");
      return;
    }
    if (url.pathname === "/billing/free") {
      respond(res, billingFreeHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/billing/success") {
      respond(res, billingSuccessHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/billing/premium") {
      respond(res, billingPremiumHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/admin/users") {
      respond(res, adminUsersHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/") {
      respond(res, dashboardHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/reorder") {
      respond(res, reorderHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/send/reorder") {
      respond(res, reorderSendHtml, "text/html; charset=utf-8");
      return;
    }
    const themeHtml = themes[url.pathname];
    if (themeHtml) {
      respond(res, page(themeHtml, css, ["/widget.js"]), "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/send/fixture") {
      respond(res, sendHtml, "text/html; charset=utf-8");
      return;
    }
    if (url.pathname === "/send/unsafe") {
      respond(res, unsafeHtml, "text/html; charset=utf-8");
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not-the-fixture" }));
    })();
  });

  return origin;
}

export type { Server };
