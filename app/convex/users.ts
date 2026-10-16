import { query } from "./_generated/server";
import { requireUser } from "./lib/identity";

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
