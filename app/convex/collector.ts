import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { bumpIpWindow, bumpVanityDailyCap } from "./lib/rateLimit";
import { insertEventRow } from "./lib/events";

/** Daily cap on stored events per vanity — bounds table growth and
 * poisoning (plan §7). Events past the cap are dropped silently; the
 * collector still returns 204 either way. */
const DAILY_EVENT_CAP_DEFAULT = 5000;
const MAX_BODY_BYTES = 32 * 1024;

/**
 * Ingest one analytics beacon for a vanity. Never throws to the caller:
 * unknown vanity, malformed payload, over-cap, or over-rate events are all
 * dropped silently (the HTTP layer always returns 204 — no enumeration).
 * No PII: payload fields are length-capped and query strings are stripped.
 */
export const ingestBeacon = internalMutation({
  args: {
    vanity: v.string(),
    ip: v.optional(v.string()),
    body: v.string(), // raw text/plain body, already size-capped by the route
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Per-IP advisory window (~30/min): matched against a forwarded-for
    // derived ip; direct *.convex.site callers control that header, so this
    // is noise control, not a security boundary (plan §7).
    const rl = await bumpIpWindow(ctx, "collect", args.ip, 60_000, 30);
    if (rl && !rl.ok) return null;

    let parsed: {
      event?: unknown;
      path?: unknown;
      ref?: unknown;
      subject?: unknown;
    };
    try {
      parsed = JSON.parse(args.body);
    } catch {
      return null; // malformed → dropped
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.event !== "form_view") return null; // only views via beacon

    const user = await ctx.db
      .query("users")
      .withIndex("by_vanity", (q) => q.eq("vanityName", args.vanity))
      .unique();
    if (!user) return null; // unknown vanity → dropped (204 upstream)

    // Per-vanity daily enforced cap.
    const cap = await bumpVanityDailyCap(
      ctx,
      "events",
      args.vanity,
      DAILY_EVENT_CAP_DEFAULT,
    );
    if (!cap.ok) return null;

    const clean = (value: unknown, max: number): string | undefined => {
      if (typeof value !== "string") return undefined;
      // Drop query strings — they can carry PII/campaign identifiers.
      const noQuery = value.split("?")[0].slice(0, max);
      return noQuery.length > 0 ? noQuery : undefined;
    };

    await insertEventRow(ctx, {
      ownerId: user._id,
      type: "form_view",
      path: clean(parsed.path, 200),
      ref: clean(parsed.ref, 200),
    });
    return null;
  },
});

export const MAX_BODY = MAX_BODY_BYTES;
