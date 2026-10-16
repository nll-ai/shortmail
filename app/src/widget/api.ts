/**
 * The one owner of the Convex deployment-URL topology (codebase-design
 * review, finding 4): function/HTTP endpoints live on the `.convex.site`
 * twin of the `.convex.cloud` URL the app is configured with. Callers never
 * spell the derivation themselves.
 */

export function convexSiteUrl(): string {
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
