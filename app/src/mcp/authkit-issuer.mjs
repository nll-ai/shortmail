/**
 * Which AuthKit domain signs MCP access tokens.
 *
 * The client id is the WorkOS environment. Preview builds sign in with the
 * staging client, so they must not advertise the production AuthKit domain.
 * An explicit WORKOS_AUTHKIT_ISSUER wins. On Vercel, the deployment
 * environment decides: preview is staging, production is production.
 * Off Vercel, the client id decides.
 */

export const PRODUCTION_CLIENT_ID = "client_01KHAAXWXVRTTH5J15474B94XY";
export const STAGING_CLIENT_ID = "client_01KHAAXWG3K6XNB22SCMWGGRYH";

export const PRODUCTION_AUTHKIT_ISSUER = "https://fair-rose-65.authkit.app";
export const STAGING_AUTHKIT_ISSUER = "https://warm-respect-91-staging.authkit.app";

const ISSUER_BY_CLIENT_ID = {
  [PRODUCTION_CLIENT_ID]: PRODUCTION_AUTHKIT_ISSUER,
  [STAGING_CLIENT_ID]: STAGING_AUTHKIT_ISSUER,
};

/**
 * AuthKit issuer for this process.
 *
 * :param env: Process environment. `WORKOS_CLIENT_ID` and `VERCEL_ENV` are read.
 * :returns: Issuer URL without a trailing slash, or null when it cannot be resolved.
 */
export function resolveAuthkitIssuer(env) {
  const explicit = (env.WORKOS_AUTHKIT_ISSUER ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;

  if (env.VERCEL_ENV === "preview") return STAGING_AUTHKIT_ISSUER;
  if (env.VERCEL_ENV === "production") return PRODUCTION_AUTHKIT_ISSUER;

  const clientId = (env.WORKOS_CLIENT_ID ?? "").trim();
  return ISSUER_BY_CLIENT_ID[clientId] ?? null;
}
