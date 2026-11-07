/**
 * The one owner of the Convex deployment-URL topology (codebase-design
 * review, finding 4): function/HTTP endpoints live on the `.convex.site`
 * twin of the `.convex.cloud` URL the app is configured with. Callers never
 * spell the derivation themselves.
 *
 * Local `npx convex dev` does not use those hostnames. It writes
 * `NEXT_PUBLIC_CONVEX_SITE_URL` (typically `http://127.0.0.1:3211`).
 * Prefer that when it is set, and keep the hosted twin derivation otherwise.
 */

export function convexSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
    ".convex.cloud",
    ".convex.site",
  );
}

export function sendUrl(vanity: string): string {
  return `${convexSiteUrl()}/api/send/${encodeURIComponent(vanity)}`;
}

export function collectUrl(vanity: string): string {
  return `${convexSiteUrl()}/api/collect/${encodeURIComponent(vanity)}`;
}

export function configUrl(vanity: string): string {
  return `${convexSiteUrl()}/api/embed/${encodeURIComponent(vanity)}/config`;
}
