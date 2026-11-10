const FALLBACK = "https://shortmail-gamma.vercel.app/callback";

/**
 * HTTPS hosts that may receive the WorkOS callback on themselves.
 *
 * Gamma stays trusted while DNS still points the canonical name at Modal.
 * Preview hosts are matched separately. Anything else uses the fallback.
 */
const TRUSTED_HTTPS_HOSTS = new Set([
  "shortmail.nonlinearlabs.ai",
  "shortmail-gamma.vercel.app",
]);

const PREVIEW_HOST =
  /^shortmail-[a-z0-9]+-eric-mas-projects-a230afd1\.vercel\.app$/;

/**
 * Callback URL for the host that started sign-in.
 *
 * The PKCE verifier cookie is host-only. WorkOS must return to that same
 * host, or the callback cannot see the cookie. Untrusted hosts, including
 * lookalikes and plain HTTP on a public host, use the fallback so this
 * cannot become an open redirect.
 *
 * :param origin: Request origin, such as `https://preview.example`.
 * :param fallback: Env redirect URI used when the origin is not this app.
 * :returns: Absolute `/callback` URL on an allowed host.
 */
export function callbackUrlFor(origin: string, fallback: string = FALLBACK): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return fallback;
  }

  const host = url.hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const trusted =
    TRUSTED_HTTPS_HOSTS.has(host) || PREVIEW_HOST.test(host);
  const https = url.protocol === "https:";
  if (!(trusted || local) || (!https && !local)) {
    return fallback;
  }
  return new URL("/callback", url.origin).toString();
}
