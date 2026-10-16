import { MutationCtx } from "../_generated/server";

export type RateLimitResult = { ok: boolean; count: number };

/**
 * Fixed-window rate limiter backed by the single-doc `rateLimits` table.
 *
 * `bump` increments the counter for `key`; when `windowMs` is set and the
 * window has expired, the counter restarts. `windowMs === null` means the key
 * itself encodes the window (e.g. `cap:{vanity}:{YYYY-MM-DD}`), so it is
 * never time-reset — a new window is simply a new key.
 *
 * Returns { ok: false } once the count exceeds `max` (the call still
 * records the increment so sustained abuse is visible in the count).
 */
export async function bump(
  ctx: MutationCtx,
  key: string,
  windowMs: number | null,
  max: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!existing) {
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return { ok: 1 <= max, count: 1 };
  }

  const expired = windowMs !== null && now - existing.windowStart >= windowMs;
  if (expired) {
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return { ok: 1 <= max, count: 1 };
  }

  const count = existing.count + 1;
  await ctx.db.patch(existing._id, { count });
  return { ok: count <= max, count };
}

/** UTC calendar day (YYYY-MM-DD) used in daily-cap keys. */
export function utcDay(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}
