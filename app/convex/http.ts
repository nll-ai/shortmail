import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

/**
 * Public HTTP endpoints (P1 fills these in):
 * - GET  /api/embed/{vanity}/config
 * - POST /api/send/{vanity}
 * - POST /api/collect/{vanity}
 * All cross-origin callable (embedded widget): preflight + ACAO:*.
 */
export const corsHeaders = {
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

void httpAction;

const http = httpRouter();

// Ensure at least one route exists so the router validates.
http.route({
  path: "/api/healthz",
  method: "GET",
  handler: httpAction(async () => respond("ok")),
});

export default http;
