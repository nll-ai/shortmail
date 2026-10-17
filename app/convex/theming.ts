import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { findUserByIdentity, getOrCreateCurrentUser } from "./lib/identity";
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
    const user = await findUserByIdentity(ctx);
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
  handler: async (ctx, args) => {
    const user = await getOrCreateCurrentUser(ctx);
    if (!user.isPaid) throw new ConvexError("PREMIUM_REQUIRED");
    if (!THEME_PRESETS.some((p) => p.id === args.preset)) {
      throw new ConvexError("UNKNOWN_PRESET");
    }

    let sanitized: string | undefined;
    if (args.customCss && args.customCss.trim().length > 0) {
      const result = sanitizeCss(args.customCss);
      if (!result.ok) throw new ConvexError(result.error);
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
