/**
 * Privacy filter for Vercel Web Analytics pageviews.
 *
 * Tracked URLs keep origin and path only. Auth callbacks, API routes, and
 * token-bearing URLs are dropped entirely so secrets never leave the browser.
 */

export type AnalyticsBeforeSendEvent = {
  type: "pageview" | "event";
  url: string;
};

const TOKEN_QUERY_KEYS = new Set([
  "access_token",
  "code",
  "id_token",
  "refresh_token",
  "session_secret",
  "session_token",
  "state",
  "token",
  "verify_token",
]);

/**
 * True when the pathname is an auth callback or an API route.
 *
 * :param pathname: URL pathname, with or without a trailing slash.
 * :returns: Whether the event must not be sent.
 */
export function isSensitivePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const lower = path.toLowerCase();
  if (lower === "/callback" || lower.startsWith("/callback/")) return true;
  if (lower === "/auth" || lower.startsWith("/auth/")) return true;
  if (lower === "/api" || lower.startsWith("/api/")) return true;
  return false;
}

/**
 * True when the URL carries a token in the query string or fragment.
 *
 * Covers OAuth `code`/`state`/`*_token` params and the `/verify` fragment
 * (`#t=…`).
 *
 * :param url: Parsed event URL.
 * :returns: Whether the event must not be sent.
 */
export function isTokenBearingUrl(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (isTokenKey(key)) return true;
  }
  const hash = url.hash.replace(/^#/, "");
  if (!hash) return false;
  if (hash.startsWith("t=")) return true;
  for (const key of new URLSearchParams(hash).keys()) {
    if (key.toLowerCase() === "t" || isTokenKey(key)) return true;
  }
  return false;
}

/**
 * Drop sensitive events; otherwise return the event with query and hash
 * removed so only the path is recorded.
 *
 * :param event: Analytics event from `@vercel/analytics`.
 * :returns: The sanitized event, or `null` to skip tracking.
 */
export function beforeSendAnalytics(
  event: AnalyticsBeforeSendEvent,
): AnalyticsBeforeSendEvent | null {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (isSensitivePath(url.pathname) || isTokenBearingUrl(url)) {
    return null;
  }
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

function isTokenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("token") || TOKEN_QUERY_KEYS.has(lower);
}
