import { mutation, query } from "./_generated/server";
import { getOrCreateCurrentUser } from "./lib/identity";

export const me = query({
  args: {},
  handler: async (ctx) => {
    // Read-only: null when the caller has no row yet (ensureMe provisions it).
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const maybe = await ctx.db
      .query("users")
      .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
      .unique();
    if (!maybe) return null;
    const user = maybe;
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
