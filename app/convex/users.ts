import { internalQuery, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { findUserByIdentity, getOrCreateCurrentUser } from "./lib/identity";

export const me = query({
  args: {},
  handler: async (ctx) => {
    // Read-only: null when the caller has no row yet (ensureMe provisions it).
    const user = await findUserByIdentity(ctx);
    if (!user) return null;
    return {
      email: user.email,
      vanityName: user.vanityName,
      displayName: user.displayName,
      isPaid: user.isPaid,
      adminRole: user.adminRole,
      embedAllowedOrigins: user.embedAllowedOrigins ?? [],
    };
  },
});

/**
 * First-login entry point: creates (or adopts a migrated row for) the
 * caller's user row. Safe to call repeatedly.
 */
export const ensureMe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getOrCreateCurrentUser(ctx);
    return {
      email: user.email,
      vanityName: user.vanityName,
      displayName: user.displayName,
      isPaid: user.isPaid,
      adminRole: user.adminRole,
      embedAllowedOrigins: user.embedAllowedOrigins ?? [],
    };
  },
});

/** Internal read of a user row by id (used by the email action to derive
 * the recipient from the owner structurally). */
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ? { email: user.email, vanityName: user.vanityName } : null;
  },
});

/** Premium-gated: which origins may embed this owner's form (plan §3.5).
 * Empty/absent = open embedding (the default). */
export const setEmbedAllowedOrigins = mutation({
  args: { origins: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await getOrCreateCurrentUser(ctx);
    if (!user.isPaid) throw new ConvexError("PREMIUM_REQUIRED");
    const cleaned = args.origins
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter((o) => o.startsWith("https://") || o.startsWith("http://localhost"))
      .slice(0, 20);
    await ctx.db.patch(user._id, { embedAllowedOrigins: cleaned });
    return cleaned;
  },
});
