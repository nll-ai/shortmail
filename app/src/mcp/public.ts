/**
 * Public MCP addresses. These are not secrets. The issuer comes from
 * `resolveAuthkitIssuer`: preview deployments use staging AuthKit, and
 * production uses production AuthKit.
 */

import { resolveAuthkitIssuer } from "./authkit-issuer.mjs";

export {
  PRODUCTION_AUTHKIT_ISSUER,
  PRODUCTION_CLIENT_ID,
  STAGING_AUTHKIT_ISSUER,
  STAGING_CLIENT_ID,
  resolveAuthkitIssuer,
} from "./authkit-issuer.mjs";

export const PRODUCTION_MCP_RESOURCE = "https://shortmail.nonlinearlabs.ai/mcp";

export const MCP_SCOPES = ["openid", "email", "profile", "offline_access"] as const;

/**
 * Canonical MCP resource URL for this process.
 *
 * Preview uses the stable branch host. A one-off deployment host would
 * mint a token Convex was not configured to accept.
 *
 * :param env: Process environment.
 * :returns: Absolute URL of the MCP endpoint, without a trailing slash.
 */
export function mcpResourceUrl(env: Record<string, string | undefined>): string {
  const explicit = env.SHORTMAIL_MCP_RESOURCE?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (env.VERCEL_ENV === "production") return PRODUCTION_MCP_RESOURCE;
  const branch = env.VERCEL_BRANCH_URL?.trim();
  if (env.VERCEL_ENV === "preview" && branch) {
    const host = branch.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/mcp`;
  }
  const origin = (env.SHORTMAIL_PUBLIC_ORIGIN ?? "http://localhost:3000").trim();
  return `${origin.replace(/\/$/, "")}/mcp`;
}

/**
 * AuthKit issuer that signs MCP access tokens for this deployment.
 *
 * :param env: Process environment.
 * :returns: Issuer URL without a trailing slash, or null when unset.
 */
export function authkitIssuer(env: Record<string, string | undefined>): string | null {
  return resolveAuthkitIssuer(env);
}

/**
 * Audiences this deployment will accept.
 *
 * The resource URL is the spec audience. The WorkOS client id is included
 * because AuthKit uses it when no resource indicator is configured.
 *
 * :param env: Process environment.
 * :returns: Audience strings, resource first.
 */
export function mcpAudiences(env: Record<string, string | undefined>): string[] {
  const audiences = [mcpResourceUrl(env)];
  const clientId = env.WORKOS_CLIENT_ID?.trim();
  if (clientId && !audiences.includes(clientId)) audiences.push(clientId);
  return audiences;
}

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: ["header"];
  scopes_supported: readonly string[];
};

/**
 * OAuth protected-resource metadata for the MCP endpoint.
 *
 * :param resource: Canonical MCP URL.
 * :param issuer: AuthKit issuer.
 * :returns: RFC 9728 document.
 */
export function protectedResourceMetadata(
  resource: string,
  issuer: string,
): ProtectedResourceMetadata {
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: MCP_SCOPES,
  };
}

/**
 * Where clients fetch protected-resource metadata for a path resource.
 *
 * :param resource: MCP endpoint URL, for example `https://host/mcp`.
 * :returns: `https://host/.well-known/oauth-protected-resource/mcp`.
 */
export function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource/mcp`;
}

/**
 * `WWW-Authenticate` challenge that points clients at AuthKit via metadata.
 *
 * :param resource: Canonical MCP URL.
 * :returns: Header value, without the header name.
 */
export function wwwAuthenticate(resource: string): string {
  const metadata = protectedResourceMetadataUrl(resource);
  return [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${metadata}"`,
  ].join(", ");
}
