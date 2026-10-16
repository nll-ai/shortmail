import { mutation, query } from "./_generated/server";
import { getOrCreateCurrentUser, requireUser } from "./lib/identity";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
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
