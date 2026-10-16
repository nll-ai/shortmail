import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

export const FREE_HEADING_LIMIT = 5;
export const FREE_FAQ_LIMIT = 3;
export const DAILY_SEND_CAP_DEFAULT = 200;

const ADMIN_LEVELS: Record<string, number> = {
  moderator: 1,
  admin: 2,
  super_admin: 3,
};

export type AuthIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
};

/**
 * Read the WorkOS identity from the Convex auth context.
 * Throws if unauthenticated.
 */
export async function getAuthIdentity(ctx: QueryCtx | MutationCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return {
    subject: identity.subject,
    email: (identity.email ?? "").toLowerCase(),
    emailVerified: identity.emailVerified === true,
  };
}

/**
 * Find or create the app-level user row for the authenticated WorkOS identity.
 * Retries once on the unique-index race (two concurrent first logins).
 */
export async function getOrCreateCurrentUser(
  ctx: MutationCtx,
): Promise<Doc<"users">> {
  const identity = await getAuthIdentity(ctx);

  const existing = await ctx.db
    .query("users")
    .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
    .unique();
  if (existing) {
    if (existing.email !== identity.email && identity.email) {
      await ctx.db.patch(existing._id, { email: identity.email });
    }
    return existing;
  }

  const vanityBase =
    identity.email.split("@")[0]?.replace(/[^a-z0-9-_]/gi, "").slice(0, 30) ||
    "user";
  const vanityName = `${vanityBase || "user"}-${identity.subject.slice(-6).toLowerCase()}`;

  try {
    const id = await ctx.db.insert("users", {
      email: identity.email,
      workosUserId: identity.subject,
      vanityName,
      isPaid: false,
      adminRole:
        identity.emailVerified &&
        identity.email &&
        process.env.SUPER_ADMIN_EMAIL &&
        identity.email === process.env.SUPER_ADMIN_EMAIL.toLowerCase()
          ? "super_admin"
          : undefined,
      createdAt: Date.now(),
    });
    return (await ctx.db.get(id))!;
  } catch {
    // Insert conflict. Two causes:
    // 1. A concurrent first-login inserted this workosUserId first.
    // 2. A migrated row exists for this email (or an alias email) with a
    //    placeholder workosUserId (`migrated:<email>`): adopt it — stamp the
    //    real WorkOS id, keep vanity/displayName/isPaid/adminRole.
    const raced = await ctx.db
      .query("users")
      .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
      .unique();
    if (raced) return raced;

    if (identity.email) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
      if (byEmail) {
        await adoptUser(ctx, byEmail, identity);
        return (await ctx.db.get(byEmail._id))!;
      }
      // Alias emails can't use the by_alias index for membership (convex eq
      // on an array field is exact-array equality), and the alias set is tiny,
      // so a bounded scan over aliased rows is the correct lookup here.
      const aliased = await ctx.db
        .query("users")
        .filter((q) => q.neq(q.field("aliases"), undefined))
        .collect();
      const byAlias = aliased.find((u) => u.aliases?.includes(identity.email));
      if (byAlias) {
        await adoptUser(ctx, byAlias, identity);
        return (await ctx.db.get(byAlias._id))!;
      }
    }
    throw new Error("User creation conflict");
  }
}

/**
 * Bind a real WorkOS identity to an existing (typically migrated) user row,
 * preserving its vanity/displayName/isPaid. Grants super_admin when the
 * verified email matches SUPER_ADMIN_EMAIL.
 */
async function adoptUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  identity: AuthIdentity,
): Promise<void> {
  await ctx.db.patch(user._id, {
    workosUserId: identity.subject,
    email: identity.email || user.email,
    adminRole:
      identity.emailVerified &&
      identity.email &&
      process.env.SUPER_ADMIN_EMAIL &&
      identity.email === process.env.SUPER_ADMIN_EMAIL.toLowerCase()
        ? "super_admin"
        : user.adminRole,
  });
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await getAuthIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
    .unique();
  if (!user) throw new Error("Unauthenticated");
  return user;
}

export function requirePremium(user: Doc<"users">): void {
  if (!user.isPaid) {
    throw new Error("PREMIUM_REQUIRED");
  }
}

export function requireAdminRole(
  user: Doc<"users">,
  min: "moderator" | "admin" | "super_admin",
): void {
  const level = user.adminRole ? ADMIN_LEVELS[user.adminRole] ?? 0 : 0;
  if (level < ADMIN_LEVELS[min]) {
    throw new Error("FORBIDDEN");
  }
}
