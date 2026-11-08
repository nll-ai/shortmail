import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import { compile } from "@tailwindcss/node";

const QUESTION = "Can I find time with you to chat?";
const ANSWER =
  "Yes, please use Calendly: https://calendly.com/ericmjl/45-minute-meeting.";
const LABEL =
  "FIXTURE — real widget.js, mocked config. Not a signed-in account. No Convex write. No email.";

const CLASSES = [
  "bg-neutral-900", "px-4", "py-2", "text-xs", "tracking-wide", "text-white",
  "mx-auto", "max-w-6xl", "max-w-lg", "p-8", "p-6", "text-2xl", "font-bold",
  "mt-2", "text-sm", "mt-6", "grid", "grid-cols-1", "gap-8",
  "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]", "min-w-0", "space-y-8",
  "border", "p-4", "mb-3", "uppercase", "tracking-[0.2em]", "space-y-3",
  "flex", "items-center", "justify-between", "gap-2", "font-medium",
  "text-blue-600", "text-red-600", "whitespace-pre-wrap", "text-gray-600",
  "space-y-2", "text-gray-500", "border-black", "bg-black", "tracking-[0.14em]",
  "space-y-4", "self-start", "border-neutral-300", "bg-white", "w-full",
  "border-b", "border-neutral-400", "bg-transparent", "px-1", "py-1",
  "min-h-20",
];

type Faq = { question: string; answer: string };

const configs: Record<string, { displayName: string; headings: string[]; faqs: Faq[] }> = {
  fixture: {
    displayName: "Fixture Owner",
    headings: ["Data request"],
    faqs: [{ question: QUESTION, answer: ANSWER }],
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
  },
};

const calls: string[] = [];

function page(body: string, css: string, harness: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><script src="/widget.js" defer></script>${harness ? '<script src="/harness.js" defer></script>' : ""}</head><body><p class="bg-neutral-900 px-4 py-2 text-xs tracking-wide text-white">${LABEL}</p>${body}</body></html>`;
}

function dashboard(css: string): string {
  return page(
    `<main class="mx-auto max-w-6xl p-8">
      <h1 class="text-2xl font-bold">ShortMail Dashboard</h1>
      <p class="mt-2 text-sm">Fixture owner. This page is not signed in.</p>
      <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section class="min-w-0 space-y-8 border p-4 text-sm">
          <h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em]">FAQs</h2>
          <p class="font-medium">${QUESTION}</p>
          <p class="whitespace-pre-wrap text-gray-600">${ANSWER}</p>
          <p class="text-xs text-gray-500">These buttons call the real preview event. They do not save and they do not send mail.</p>
          <form id="add-form" class="space-y-2">
            <input id="previous" class="w-full border-0 border-b border-neutral-400 bg-transparent px-1 py-1 text-sm" value="${QUESTION}" />
            <input id="question" class="w-full border-0 border-b border-neutral-400 bg-transparent px-1 py-1 text-sm" value="${QUESTION}" />
            <textarea id="answer" class="w-full min-h-20 border-0 border-b border-neutral-400 bg-transparent px-1 py-1 text-sm">${ANSWER}</textarea>
            <button id="add-faq" type="submit" class="border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">Add FAQ</button>
            <button id="save-edit" type="button" class="border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">Save edit</button>
            <button id="remove-faq" type="button" class="text-xs text-red-600">Remove</button>
          </form>
        </section>
        <div class="space-y-4 self-start">
          <p class="text-xs uppercase tracking-wide text-gray-500">Live preview — what your visitors see</p>
          <div id="frame" class="border border-neutral-300 bg-white p-6">
            <shortmail-widget vanity="fixture"></shortmail-widget>
          </div>
        </div>
      </div>
    </main>`,
    css,
    true,
  );
}

function hosted(css: string, vanity: string): string {
  return page(
    `<main class="mx-auto max-w-lg border border-neutral-300 bg-white p-6 text-sm">
      <shortmail-widget vanity="${vanity}"></shortmail-widget>
    </main>`,
    css,
    false,
  );
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
    },
    bundle: true,
    format: "iife",
    outdir,
    define: {
      "process.env.WIDGET_CONVEX_SITE_URL": JSON.stringify(origin),
    },
  });
  const widgetJs = readFileSync(path.join(outdir, "widget.js"));
  const harnessJs = readFileSync(path.join(outdir, "harness.js"));
  const globals = readFileSync(path.join(appRoot, "src/app/globals.css"), "utf8");
  const compiled = await compile(globals, {
    base: appRoot,
    onDependency: () => undefined,
  });
  const css = `${globals}\n${compiled.build(CLASSES)}`;
  const dashboardHtml = dashboard(css);
  const sendHtml = hosted(css, "fixture");
  const unsafeHtml = hosted(css, "unsafe");

  const respond = (res: import("node:http").ServerResponse, body: string | Buffer, type: string) => {
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  };

  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", origin);
    calls.push(`${req.method} ${url.pathname}`);
    if (req.method === "POST" && url.pathname === "/__reset") {
      calls.length = 0;
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/__calls") {
      respond(res, JSON.stringify(calls), "application/json");
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
    const embed = url.pathname.match(/^\/api\/embed\/([^/]+)\/config$/);
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
          theme: null,
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
    if (url.pathname === "/") {
      respond(res, dashboardHtml, "text/html; charset=utf-8");
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
  });

  return origin;
}

export type { Server };
