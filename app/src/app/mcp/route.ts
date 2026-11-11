import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { authUnavailable, bearerToken, handleMcpRequest, unauthorized } from "@/mcp/http";
import { convexPageGateway } from "@/mcp/pageGateway";
import { authkitIssuer, mcpAudiences, mcpResourceUrl } from "@/mcp/public";
import { AuthServerUnavailable, verifyMcpAccessToken } from "@/mcp/verifyToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let cachedIssuer = "";
let cachedKeys: JWTVerifyGetKey | undefined;

function signingKeys(issuer: string): JWTVerifyGetKey {
  if (!cachedKeys || cachedIssuer !== issuer) {
    cachedIssuer = issuer;
    cachedKeys = createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`));
  }
  return cachedKeys;
}

/**
 * Accept a bearer token and bind Convex to that WorkOS user.
 *
 * Missing and invalid tokens get the protected-resource challenge. A
 * signing-key outage is a 503 so the client does not start a new login.
 */
async function authenticate(request: Request) {
  const resource = mcpResourceUrl(process.env);
  const token = bearerToken(request);
  if (!token) return { ok: false as const, response: unauthorized(resource) };
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  const issuer = authkitIssuer(process.env);
  try {
    await verifyMcpAccessToken(token, {
      jwks: signingKeys(issuer),
      issuer,
      audiences: mcpAudiences(process.env),
    });
  } catch (error) {
    if (error instanceof AuthServerUnavailable) {
      return { ok: false as const, response: authUnavailable() };
    }
    return { ok: false as const, response: unauthorized(resource) };
  }
  return { ok: true as const, gateway: convexPageGateway(convexUrl, token) };
}

function respond(request: Request) {
  return handleMcpRequest(request, {
    resource: mcpResourceUrl(process.env),
    authenticate,
  });
}

export const GET = respond;
export const POST = respond;
export const DELETE = respond;
export const OPTIONS = respond;
