import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MAX_BODY } from "./collector";
import { marked } from "marked";
import { isDisposableEmail } from "./lib/disposableDomains";

/**
 * Public HTTP endpoints (called cross-origin by the embedded widget and the
 * hosted /send pages), each with an OPTIONS preflight + ACAO:*:
 * - GET  /api/embed/{vanity}/config
 * - POST /api/send/{vanity}
 * - POST /api/collect/{vanity}
 *
 * Note: the `preflight` helper does not exist in convex@1.47.0 (checked the
 * installed package), so preflights are explicit OPTIONS routes with the
 * same headers.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const respond = (
  body: string,
  status = 200,
  extra: Record<string, string> = {},
) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, ...extra },
  });

const json = (body: unknown, status = 200) =>
  respond(JSON.stringify(body), status, { "Content-Type": "application/json" });

const jsonError = (error: string, status: number) => json({ error }, status);

/** Vanity from a `/api/{section}/{vanity}` path, or null. */
function vanityFrom(url: string, section: "send" | "collect"): string | null {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "api" || parts[1] !== section) {
    return null;
  }
  return decodeURIComponent(parts[2]);
}

/** Vanity + trailing segment for `/api/embed/{vanity}/{rest}`. */
function embedPathFrom(url: string): { vanity: string; rest: string } | null {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "api" || parts[1] !== "embed") {
    return null;
  }
  return { vanity: decodeURIComponent(parts[2]), rest: parts[3] };
}

const handlePreflight = httpAction(async () =>
  new Response(null, { status: 204, headers: corsHeaders }),
);

const http = httpRouter();

http.route({
  pathPrefix: "/api/embed/",
  method: "OPTIONS",
  handler: handlePreflight,
});
http.route({
  pathPrefix: "/api/send/",
  method: "OPTIONS",
  handler: handlePreflight,
});
http.route({
  pathPrefix: "/api/collect/",
  method: "OPTIONS",
  handler: handlePreflight,
});

// ---------------------------------------------------------------------------
// GET /api/embed/{vanity}/config — public config for hosted page + widget
// ---------------------------------------------------------------------------
http.route({
  pathPrefix: "/api/embed/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const path = embedPathFrom(request.url);
    if (!path || path.rest !== "config") {
      return jsonError("not_found", 404);
    }
    const config = await ctx.runQuery(internal.public.configForVanity, {
      vanity: path.vanity,
    });
    if (!config) return jsonError("user_not_found", 404);
    return json(config);
  }),
});

// ---------------------------------------------------------------------------
// POST /api/send/{vanity} — the one send path (hosted page + widget)
// ---------------------------------------------------------------------------
const MAX_MESSAGE_LENGTH = 500;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseFormField(field: unknown): string {
  return typeof field === "string" ? field : field == null ? "" : String(field);
}

async function readFormFields(
  request: Request,
): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = await request.json();
      if (parsed === null || typeof parsed !== "object") return null;
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
          k,
          parseFormField(v),
        ]),
      );
    } catch {
      return null;
    }
  }
  // Default: application/x-www-form-urlencoded (the widget + legacy form).
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

http.route({
  pathPrefix: "/api/send/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const vanity = vanityFrom(request.url, "send");
    if (!vanity) return jsonError("not_found", 404);

    const fields = await readFormFields(request);
    if (!fields) return jsonError("invalid_body", 400);

    // Honeypot: bots filling the invisible `website` field get a quiet 400.
    if (fields.website !== undefined && fields.website !== "") {
      return jsonError("spam_detected", 400);
    }

    const senderName = (fields.sender_name ?? "").trim();
    if (!senderName) return jsonError("sender_name_required", 400);

    const senderEmail = (fields.sender_email ?? "").trim().toLowerCase();
    if (!EMAIL_SHAPE.test(senderEmail)) {
      return jsonError("invalid_email", 400);
    }
    if (isDisposableEmail(senderEmail)) {
      return jsonError("disposable_email", 400);
    }

    const message = fields.message ?? "";
    if (!message.trim()) return jsonError("message_required", 400);
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError("message_too_long", 400);
    }

    // Subject: selected heading, or the custom text when "OTHER" is picked.
    let subject = (fields.subject ?? "").trim();
    if (subject === "OTHER") subject = (fields.custom_subject ?? "").trim();
    if (!subject) return jsonError("subject_required", 400);

    // Legacy parity: only the literal "yes" counts as reply-needed.
    const replyNeeded = fields.reply_needed === "yes";
    const taggedSubject = `${replyNeeded ? "[RN]" : "[NRN]"} ${subject}`;

    const text = `From: ${senderName} <${senderEmail}>\n\n${message}`;
    const html = `<p>${escapeHtml(`From: ${senderName} <${senderEmail}>`)}</p>\n${markdownToSafeHtml(message)}`;

    // x-forwarded-for is attacker-controlled on *.convex.site (plan §7), so
    // the per-IP window is advisory; absence of the header is fine.
    const ip = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ?? undefined;

    const result = await ctx.runMutation(internal.public.submitSend, {
      vanity,
      senderName,
      senderEmail,
      subject: taggedSubject,
      html,
      text,
      ip,
      idempotencyKey: crypto.randomUUID(),
    });

    if (!result.ok) {
      if (result.reason === "user_not_found") {
        return jsonError("user_not_found", 404);
      }
      return jsonError("daily_cap_exceeded", 429);
    }

    return json({ ok: true });
  }),
});

// ---------------------------------------------------------------------------
// POST /api/collect/{vanity} — analytics beacon sink (P4 fills storage)
// Read + discard, always 204 (never confirms whether a vanity exists).
// ---------------------------------------------------------------------------
http.route({
  pathPrefix: "/api/collect/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Always 204, never enumerate: read the body, validate size/content-type,
    // and let the collector decide whether to store (plan R5, §7).
    const contentType = request.headers.get("content-type") ?? "";
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > MAX_BODY) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY || (contentType && !contentType.includes("text/plain"))) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const vanity = vanityFrom(request.url, "collect");
    const ip = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();

    try {
      await ctx.runMutation(internal.collector.ingestBeacon, {
        vanity: vanity ?? "",
        ip: ip || undefined,
        body: raw,
      });
    } catch {
      // Swallow everything: the collector response contract is 204-always.
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

// ---------------------------------------------------------------------------
// Health check (P0)
// ---------------------------------------------------------------------------
http.route({
  path: "/api/healthz",
  method: "GET",
  handler: httpAction(async () => respond("ok")),
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the message body to inert HTML: escape first (so nothing in the
 * message can become markup or script), then let markdown reintroduce only
 * paragraph/line-break structure.
 */
function markdownToSafeHtml(message: string): string {
  return marked.parse(escapeHtml(message), { async: false });
}

export default http;
