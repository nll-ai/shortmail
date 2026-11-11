/**
 * Which AuthKit domain signs MCP access tokens.
 *
 * Production ShortMail signs in through the staging WorkOS environment.
 * Preview and production Vercel builds both use that staging issuer.
 * An explicit WORKOS_AUTHKIT_ISSUER wins. Off Vercel, the client id decides.
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
 * :param env: Process environment. `WORKOS_AUTHKIT_ISSUER`, `VERCEL_ENV`,
 *   and `WORKOS_CLIENT_ID` are read.
 * :returns: Issuer URL without a trailing slash, or null when it cannot be resolved.
 */
export function resolveAuthkitIssuer(env) {
  const explicit = (env.WORKOS_AUTHKIT_ISSUER ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;

  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "production") {
    return STAGING_AUTHKIT_ISSUER;
  }

  const clientId = (env.WORKOS_CLIENT_ID ?? "").trim();
  return ISSUER_BY_CLIENT_ID[clientId] ?? null;
}
