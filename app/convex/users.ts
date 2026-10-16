import { internalQuery, mutation, query } from "./_generated/server";
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
