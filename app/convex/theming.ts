import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateCurrentUser, requirePremium } from "./lib/identity";
import { sanitizeCss } from "./lib/cssSanitize";
import { THEME_PRESETS } from "../src/widget/presets";

export type OwnerTheme = {
  preset: string;
  customCss: string | null;
};

/** Identity-scoped theme for the signed-in owner; null when unset. */
export const myTheme = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
      .unique();
    if (!user) return null;
    if (!user.isPaid) return { tier: "free" as const };
    const settings = await ctx.db
      .query("themeSettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .unique();
    return {
      tier: "premium" as const,
      preset: settings?.preset ?? "default",
      customCss: settings?.customCss ?? null,
    };
  },
});

/**
 * Save the owner's theme (premium-gated, R1). Custom CSS is sanitized at
 * save time (R2) — what gets stored is exactly what was inspected.
 */
export const saveTheme = mutation({
  args: {
    preset: v.string(),
    customCss: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const user = await getOrCreateCurrentUser(ctx);
    try {
      requirePremium(user);
    } catch {
      return { ok: false, error: "PREMIUM_REQUIRED" };
    }
    if (!THEME_PRESETS.some((p) => p.id === args.preset)) {
      return { ok: false, error: "UNKNOWN_PRESET" };
    }

    let sanitized: string | undefined;
    if (args.customCss && args.customCss.trim().length > 0) {
      const result = sanitizeCss(args.customCss);
      if (!result.ok) return { ok: false, error: result.error };
      sanitized = result.css.length > 0 ? result.css : undefined;
    }

    const existing = await ctx.db
      .query("themeSettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        preset: args.preset,
        customCss: sanitized,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("themeSettings", {
        ownerId: user._id,
        preset: args.preset,
        customCss: sanitized,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
