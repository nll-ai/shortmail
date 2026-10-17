import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { findUserByIdentity } from "./lib/identity";
import { dayKeyFromToday } from "./lib/days";
import { parseSubjectTag } from "./lib/subjectTag";

export type DayPoint = { day: string; views: number; sends: number };

export type OwnerStats = {
  tier: "premium";
  days: number;
  totals: { views: number; sends: number };
  perDay: DayPoint[];
  topSubjects: { subject: string; count: number }[];
  replyNeededRatio: number | null; // share of sends tagged [RN]
};

export type FreeStats = { tier: "free" };

const dayKey = dayKeyFromToday;

/**
 * Aggregate a user's events over the last `days` days, on the fly via the
 * by_owner_day index (≤31 bounded index ranges — no rollup machinery;
 * plan §3.7 v2). Identity-scoped (R3); premium-gated (R1).
 */
async function collectStats(
  ctx: import("./_generated/server").QueryCtx,
  ownerId: import("./_generated/dataModel").Id<"users">,
  days: number,
): Promise<OwnerStats> {
  const span = Math.min(Math.max(days, 1), 31);
  const buckets = new Map<string, DayPoint>();
  for (let i = 0; i < span; i++) {
    const day = dayKey(i);
    buckets.set(day, { day, views: 0, sends: 0 });
  }

  let views = 0;
  let sends = 0;
  let rnCount = 0;
  const subjectCounts = new Map<string, number>();

  for (let i = 0; i < span; i++) {
    const day = dayKey(i);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_owner_day", (q) =>
        q.eq("ownerId", ownerId).eq("day", day),
      )
      .collect();
    for (const row of rows) {
      const bucket = buckets.get(row.day);
      if (row.type === "form_view") {
        views++;
        if (bucket) bucket.views++;
      } else {
        sends++;
        if (bucket) bucket.sends++;
        const parsed = parseSubjectTag(row.subject);
        const name = parsed.name;
        const rn = parsed.replyNeeded;
        if (rn) rnCount++;
        if (name) {
          subjectCounts.set(name, (subjectCounts.get(name) ?? 0) + 1);
        }
      }
    }
  }

  const topSubjects = [...subjectCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subject, count]) => ({ subject, count }));

  return {
    tier: "premium",
    days: span,
    totals: { views, sends },
    perDay: [...buckets.values()],
    topSubjects,
    replyNeededRatio: sends > 0 ? rnCount / sends : null,
  };
}

/** Identity-scoped stats for the signed-in owner; premium-gated. Free
 * callers get the `{tier: "free"}` discriminator (upsell card, R1). */
export const ownerStats = query({
  args: { days: v.optional(v.number()) },
  returns: v.union(
    v.object({
      tier: v.literal("premium"),
      days: v.number(),
      totals: v.object({ views: v.number(), sends: v.number() }),
      perDay: v.array(
        v.object({
          day: v.string(),
          views: v.number(),
          sends: v.number(),
        }),
      ),
      topSubjects: v.array(
        v.object({ subject: v.string(), count: v.number() }),
      ),
      replyNeededRatio: v.union(v.number(), v.null()),
    }),
    v.object({ tier: v.literal("free") }),
  ),
  handler: async (ctx, args) => {
    const user = await findUserByIdentity(ctx);
    // Null-safe: a brand-new identity has no row and is free by definition.
    if (!user) return { tier: "free" } satisfies FreeStats;
    if (!user.isPaid) {
      return { tier: "free" } satisfies FreeStats;
    }
    return await collectStats(ctx, user._id, args.days ?? 30);
  },
});

/** Verification helper (issue #26): per-day counts for an owner email. */
export const debugDaily = internalQuery({
  args: { email: v.string(), days: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!owner) return { error: "unknown user" };
    return await collectStats(ctx, owner._id, args.days ?? 7);
  },
});
