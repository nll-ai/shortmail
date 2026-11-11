import { authkitIssuer, mcpResourceUrl, protectedResourceMetadata } from "./public";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

type CacheEntry = { at: number; body: unknown };

const authorizationServers = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;

/**
 * Protected-resource metadata for this deployment's MCP URL.
 *
 * :param env: Process environment.
 * :returns: JSON document clients fetch from `/.well-known/oauth-protected-resource`.
 */
export function protectedResourceResponse(env: Record<string, string | undefined>): Response {
  const body = protectedResourceMetadata(mcpResourceUrl(env), authkitIssuer(env));
  return Response.json(body, { headers: CORS });
}

/**
 * Proxy AuthKit's authorization-server metadata.
 *
 * Older MCP clients look for this document on the resource host. The body
 * is AuthKit's. It is cached in memory for five minutes.
 *
 * :param issuer: AuthKit issuer URL.
 * :param fetchImpl: HTTP fetch, replaceable in tests.
 * :param now: Clock for the cache.
 * :returns: The upstream JSON, or 502 when AuthKit cannot be read.
 */
export async function authorizationServerResponse(
  issuer: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<Response> {
  const cached = authorizationServers.get(issuer);
  if (cached && now - cached.at < CACHE_MS) {
    return Response.json(cached.body, { headers: CORS });
  }
  let response: Response;
  try {
    response = await fetchImpl(`${issuer}/.well-known/oauth-authorization-server`);
  } catch {
    return Response.json(
      { error: "auth_metadata_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!response.ok) {
    return Response.json(
      { error: "auth_metadata_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  const body: unknown = await response.json();
  authorizationServers.set(issuer, { at: now, body });
  return Response.json(body, { headers: CORS });
}
