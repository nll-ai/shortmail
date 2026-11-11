import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { INSTRUCTIONS, registerPageTools } from "./tools";
import type { PageGateway } from "./pageGateway";
import { wwwAuthenticate } from "./public";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version",
};

export type McpAuth =
  | { ok: true; gateway: PageGateway }
  | { ok: false; response: Response };

/**
 * Streamable HTTP MCP endpoint. One stateless server per request.
 *
 * :param request: Incoming HTTP request.
 * :param options: Auth check and the canonical resource URL for the challenge.
 * :returns: JSON-RPC response, or 401 with protected-resource metadata.
 */
export async function handleMcpRequest(
  request: Request,
  options: {
    resource: string;
    authenticate: (request: Request) => Promise<McpAuth>;
  },
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (request.method !== "POST") {
    return withCors(
      Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "POST, OPTIONS" } },
      ),
    );
  }

  const auth = await options.authenticate(request);
  if (!auth.ok) return withCors(auth.response);

  const server = new McpServer(
    { name: "shortmail", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );
  registerPageTools(server, auth.gateway);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    keepAliveMs: 0,
  });
  await server.connect(transport);
  const raw = await transport.handleRequest(request);
  const body = await raw.arrayBuffer();
  await server.close();
  return withCors(
    new Response(body, {
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers,
    }),
  );
}

/**
 * 401 challenge for a missing or rejected bearer token.
 *
 * :param resource: Canonical MCP URL.
 * :returns: JSON body plus `WWW-Authenticate`.
 */
export function unauthorized(resource: string): Response {
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": wwwAuthenticate(resource),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * AuthKit's signing keys could not be fetched. This is not a bad token.
 *
 * :returns: 503 JSON, with no token and no URL secrets.
 */
export function authUnavailable(): Response {
  return Response.json(
    { error: "auth_unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
