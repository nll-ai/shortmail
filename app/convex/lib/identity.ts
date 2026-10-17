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

/** The public-URL contract for vanities (finding 2): every writer enforces
 * this — a vanity becomes a URL path segment and an API path parameter. */
export const VANITY_PATTERN = /^[a-z0-9][a-z0-9-_]{0,39}$/;

/** Normalize + validate a vanity; null when unusable. */
export function normalizeVanity(input: string): string | null {
  const vanity = input.trim().toLowerCase();
  return VANITY_PATTERN.test(vanity) ? vanity : null;
}

/** The super-admin bootstrap rule, spelled once (finding 13a). */
function superAdminRoleFor(identity: AuthIdentity): "super_admin" | undefined {
  return identity.emailVerified &&
    identity.email &&
    process.env.SUPER_ADMIN_EMAIL &&
    identity.email === process.env.SUPER_ADMIN_EMAIL.toLowerCase()
    ? "super_admin"
    : undefined;
}

/** Read the WorkOS identity from the Convex auth context. Throws if
 * unauthenticated. Convex maps standard OIDC "email" but exposes
 * "email_verified" as a raw claim (not identity.emailVerified) for
 * customJwt providers — read both. */
export async function getAuthIdentity(ctx: QueryCtx | MutationCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return {
    subject: identity.subject,
    email: (identity.email ?? "").toLowerCase(),
    emailVerified:
      identity.emailVerified === true ||
      (identity as Record<string, unknown>).email_verified === true,
  };
}

/** The plain identity→row read, spelled once (finding 10). Null when the
 * caller has no row yet — use getOrCreateCurrentUser to provision. */
export async function findUserByIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await getAuthIdentity(ctx);
  return await ctx.db
    .query("users")
    .withIndex("by_workos", (q) => q.eq("workosUserId", identity.subject))
    .unique();
}

/** Bind a real WorkOS identity to an existing (typically migrated) user row,
 * preserving its vanity/displayName/isPaid. Grants super_admin when the
 * verified email matches SUPER_ADMIN_EMAIL. */
async function adoptUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  identity: AuthIdentity,
): Promise<void> {
  await ctx.db.patch(user._id, {
    workosUserId: identity.subject,
    email: identity.email || user.email,
    adminRole:
      superAdminRoleFor(identity) ?? user.adminRole,
  });
}

/** Migrated-row adoption is by exact email only (one account = one email;
 * no alias merging). */
async function findAdoptableUser(
  ctx: MutationCtx,
  email: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

/**
 * Find or create the app-level user row for the authenticated WorkOS
 * identity (deep module: races, migration-row adoption, alias handling and
 * the super-admin bootstrap all hide behind this one call).
 */
export async function getOrCreateCurrentUser(
  ctx: MutationCtx,
): Promise<Doc<"users">> {
  const identity = await getAuthIdentity(ctx);

  const existing = await findUserByIdentity(ctx);
  if (existing) {
    // Do NOT rewrite the row's email to the JWT email: a merged account is
    // reachable by several addresses (primary + aliases), and the row's
    // email is the primary. Alias membership covers the rest (finding: the
    // email patch flipped a merged account's primary email).
    return existing;
  }

  // Adoption BEFORE insert: Convex indexes do NOT enforce uniqueness, so a
  // migrated row (placeholder workosUserId `migrated:<email>`) or an alias
  // row must be found first — otherwise a duplicate row is created.
  if (identity.email) {
    const adoptable = await findAdoptableUser(ctx, identity.email);
    if (adoptable) {
      await adoptUser(ctx, adoptable, identity);
      return (await ctx.db.get(adoptable._id))!;
    }
  }

  const vanityBase =
    identity.email.split("@")[0]?.replace(/[^a-z0-9-_]/gi, "").slice(0, 30) ||
    "user";
  const vanityName = `${vanityBase || "user"}-${identity.subject.slice(-6).toLowerCase()}`;

  // Race backstop: a concurrent first-login may insert this workosUserId or
  // the same email between our lookups and the insert.
  const raced = await findUserByIdentity(ctx);
  if (raced) return raced;
  if (identity.email) {
    const adoptable = await findAdoptableUser(ctx, identity.email);
    if (adoptable) {
      await adoptUser(ctx, adoptable, identity);
      return (await ctx.db.get(adoptable._id))!;
    }
  }

  const id = await ctx.db.insert("users", {
    email: identity.email,
    workosUserId: identity.subject,
    vanityName,
    isPaid: false,
    adminRole: superAdminRoleFor(identity),
    createdAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

/** Query/mutation-safe read of the caller's row. Null when the caller has
 * no row yet — use getOrCreateCurrentUser to provision. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await findUserByIdentity(ctx);
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
