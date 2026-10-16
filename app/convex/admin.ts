import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdminRole, requireUser } from "./lib/identity";

/**
 * Admin surface (parity with the legacy /admin + /admin/users routes):
 * stats + user list for moderator+, isPaid toggle for moderator+,
 * role assignment and deletion for super_admin only.
 */

export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    requireAdminRole(user, "moderator");

    const users = await ctx.db.query("users").collect();
    const recent = await ctx.db
      .query("users")
      .order("desc")
      .take(10);

    return {
      totalUsers: users.length,
      paidUsers: users.filter((u) => u.isPaid).length,
      freeUsers: users.filter((u) => !u.isPaid).length,
      adminUsers: users.filter((u) => u.adminRole).length,
      recentUsers: recent.map((u) => ({
        id: u._id,
        email: u.email,
        vanityName: u.vanityName,
        isPaid: u.isPaid,
        adminRole: u.adminRole,
        createdAt: u.createdAt,
      })),
    };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    requireAdminRole(user, "moderator");

    const users = await ctx.db.query("users").order("desc").take(200);
    return users.map((u) => ({
      id: u._id,
      email: u.email,
      vanityName: u.vanityName,
      displayName: u.displayName,
      isPaid: u.isPaid,
      adminRole: u.adminRole,
      createdAt: u.createdAt,
    }));
  },
});

export const setUserPaid = mutation({
  args: { userId: v.id("users"), isPaid: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdminRole(user, "moderator");
    await ctx.db.patch(args.userId, { isPaid: args.isPaid });
  },
});

export const setUserAdminRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("moderator"),
      v.literal("admin"),
      v.literal("super_admin"),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdminRole(user, "super_admin");
    await ctx.db.patch(args.userId, {
      adminRole: args.role === null ? undefined : args.role,
    });
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdminRole(user, "super_admin");

    const headings = await ctx.db
      .query("subjectHeadings")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    for (const row of headings) await ctx.db.delete(row._id);

    const faqs = await ctx.db
      .query("faqs")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    for (const row of faqs) await ctx.db.delete(row._id);

    // Full cascade (finding 14): theme settings + analytics events are also
    // owned by the deleted user.
    const themes = await ctx.db
      .query("themeSettings")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    for (const row of themes) await ctx.db.delete(row._id);

    const events = await ctx.db
      .query("events")
      .withIndex("by_owner_day", (q) => q.eq("ownerId", args.userId))
      .collect();
    for (const row of events) await ctx.db.delete(row._id);

    await ctx.db.delete(args.userId);
  },
});

/**
 * Repair path for the super-admin bootstrap (plan §3.3): the first verified
 * login with SUPER_ADMIN_EMAIL gets the role automatically; if the env var
 * landed on the deployment late, the matching user can self-heal by calling
 * this. Env-gated: with SUPER_ADMIN_EMAIL unset, every call fails closed.
 */
export const claimSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const expected = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
    if (!expected || user.email !== expected || !user.email) {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(user._id, { adminRole: "super_admin" });
  },
});
