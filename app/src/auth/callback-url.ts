const FALLBACK = "https://shortmail-gamma.vercel.app/callback";

/**
 * Callback URL for the host that started sign-in.
 *
 * The PKCE verifier cookie is host-only. WorkOS must return to that same
 * host, or the production callback cannot see the cookie.
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
  const production = host === "shortmail-gamma.vercel.app";
  const preview = /^shortmail-[a-z0-9]+-eric-mas-projects-a230afd1\.vercel\.app$/.test(host);
  const https = url.protocol === "https:";
  if (!(production || preview || local) || (!https && !local)) {
    return fallback;
  }
  return new URL("/callback", url.origin).toString();
}
