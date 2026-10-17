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

// ---------------------------------------------------------------------------
// Purpose-named limiters (codebase-design review finding 1): the key grammar
// lives here so two limiters can never collide on a shared bucket again.
// ---------------------------------------------------------------------------

/** Advisory per-IP window (attacker-controlled header on *.convex.site). */
export async function bumpIpWindow(
  ctx: MutationCtx,
  scope: "send" | "collect",
  ip: string | undefined,
  windowMs: number,
  max: number,
): Promise<RateLimitResult | null> {
  if (!ip) return { ok: true, count: 0 };
  return bump(ctx, `win:${scope}:${ip}`, windowMs, max);
}

/** Enforced per-vanity daily cap; the key encodes BOTH the scope and the
 * day, so send-budget and event-budget buckets are structurally separate. */
export async function bumpVanityDailyCap(
  ctx: MutationCtx,
  scope: "send" | "events",
  vanity: string,
  max: number,
): Promise<RateLimitResult> {
  return bump(ctx, `cap:${scope}:${vanity}:${utcDay()}`, null, max);
}
