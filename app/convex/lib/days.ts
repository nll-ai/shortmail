/**
 * The single owner of the UTC day-string convention (YYYY-MM-DD) used as
 * the join key between event writes (public.recordEvent, collector) and
 * analytics reads (analytics.collectStats). Drift here = silently zero
 * analytics, so it is spelled exactly once.
 */

export function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Day key `offsetFromToday` days ago (0 = today). */
export function dayKeyFromToday(offsetFromToday: number): string {
  return utcDay(Date.now() - offsetFromToday * 86_400_000);
}
