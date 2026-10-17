import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { MutationCtx } from "./_generated/server";

/**
 * Idempotent demo seed so a fresh Convex backend is testable without
 * sign-in on the public path (config + send for /send/demo). Runs on every
 * preview deploy (vercel-build.sh --preview-run) and manually via
 * `npx convex run devSeed:seedDemo`.
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    await seedUser(ctx, {
      email: "shortmail-dev@nonlinearlabs.ai",
      workosUserId: "demo-workos-id",
      vanityName: "demo",
      displayName: "Demo User",
      isPaid: false,
      headings: ["Hello", "Feedback"],
      faqs: [
        {
          question: "What is ShortMail?",
          answer: "Short, thoughtful messages — max 500 characters.",
        },
        {
          question: "Who can read my message?",
          answer: "Only the person you send it to.",
        },
      ],
    });

    await seedUser(ctx, {
      email: "premium@nonlinearlabs.ai",
      workosUserId: "demo-premium-id",
      vanityName: "demo-premium",
      displayName: "Premium Demo",
      isPaid: true,
      headings: ["Consulting", "Collaboration"],
      faqs: [
        {
          question: "Do you take consulting work?",
          answer: "Yes — pick a subject and describe the project.",
        },
        {
          question: "How fast do you reply?",
          answer: "Usually within two business days.",
        },
      ],
    });
  },
});

type SeedSpec = {
  email: string;
  workosUserId: string;
  vanityName: string;
  displayName: string;
  isPaid: boolean;
  headings: string[];
  faqs: { question: string; answer: string }[];
};

async function seedUser(ctx: MutationCtx, spec: SeedSpec): Promise<void> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_vanity", (q) => q.eq("vanityName", spec.vanityName))
    .unique();
  if (existing) return;

  const userId = await ctx.db.insert("users", {
    email: spec.email,
    workosUserId: spec.workosUserId,
    vanityName: spec.vanityName,
    displayName: spec.displayName,
    isPaid: spec.isPaid,
    createdAt: Date.now(),
  });

  for (const heading of spec.headings) {
    await ctx.db.insert("subjectHeadings", { ownerId: userId, heading });
  }
  for (const faq of spec.faqs) {
    await ctx.db.insert("faqs", { ownerId: userId, ...faq });
  }
}

/** Dev/test helper: remove probe rows created during auth verification. */
export const purgeTestRows = internalMutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    let removed = 0;
    for (const email of args.emails) {
      const row = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!row) continue;
      for (const h of await ctx.db
        .query("subjectHeadings")
        .withIndex("by_owner", (q) => q.eq("ownerId", row._id))
        .collect()) {
        await ctx.db.delete(h._id);
      }
      for (const f of await ctx.db
        .query("faqs")
        .withIndex("by_owner", (q) => q.eq("ownerId", row._id))
        .collect()) {
        await ctx.db.delete(f._id);
      }
      await ctx.db.delete(row._id);
      removed++;
    }
    return removed;
  },
});

/** Dev/test helper: delete rows by vanity name. */
export const purgeByVanity = internalMutation({
  args: { vanityNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    let removed = 0;
    for (const vanity of args.vanityNames) {
      const row = await ctx.db
        .query("users")
        .withIndex("by_vanity", (q) => q.eq("vanityName", vanity))
        .unique();
      if (!row) continue;
      for (const h of await ctx.db
        .query("subjectHeadings")
        .withIndex("by_owner", (q) => q.eq("ownerId", row._id))
        .collect()) {
        await ctx.db.delete(h._id);
      }
      for (const f of await ctx.db
        .query("faqs")
        .withIndex("by_owner", (q) => q.eq("ownerId", row._id))
        .collect()) {
        await ctx.db.delete(f._id);
      }
      await ctx.db.delete(row._id);
      removed++;
    }
    return removed;
  },
});

/** Dev/test helper: toggle premium by email (admin UI covers real flow). */
export const setPaidByEmail = internalMutation({
  args: { email: v.string(), isPaid: v.boolean() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!row) return "unknown";
    await ctx.db.patch(row._id, { isPaid: args.isPaid });
    return `set isPaid=${args.isPaid} for ${row.email}`;
  },
});

/** Dev/test helper: set embed origins by email (bypasses auth; the real
 * path is users.setEmbedAllowedOrigins via the dashboard). */
export const setOriginsByEmail = internalMutation({
  args: { email: v.string(), origins: v.array(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!row) return "unknown";
    await ctx.db.patch(row._id, { embedAllowedOrigins: args.origins });
    return `set ${args.origins.length} origins for ${row.email}`;
  },
});

/** Ops helper: set a user's primary email by current email or workos id. */
export const setUserEmail = internalMutation({
  args: { currentEmail: v.string(), newEmail: v.string() },
  handler: async (ctx, args) => {
    let row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.currentEmail))
      .unique();
    if (!row) return "unknown";
    await ctx.db.patch(row._id, { email: args.newEmail });
    return `email set to ${args.newEmail}`;
  },
});

/** OPS (one-account-one-email model): split a merged alias back out into its
 * own account row. Moves explicitly-named headings; stamps the alias's real
 * WorkOS id; re-points the primary's WorkOS id when given. */
export const splitAccount = internalMutation({
  args: {
    primaryEmail: v.string(),
    aliasEmail: v.string(),
    aliasWorkosUserId: v.string(),
    aliasIsPaid: v.boolean(),
    primaryNewWorkosUserId: v.optional(v.string()),
    moveHeadingNames: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const primary = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.primaryEmail))
      .unique();
    if (!primary) throw new Error("primary not found");

    // The alias row may still exist, or may have been merged away.
    let aliasRow = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.aliasEmail))
      .unique();

    const vanityBase =
      args.aliasEmail.split("@")[0]?.replace(/[^a-z0-9-_]/gi, "").slice(0, 24) ||
      "user";
    if (!aliasRow) {
      const id = await ctx.db.insert("users", {
        email: args.aliasEmail,
        workosUserId: args.aliasWorkosUserId,
        vanityName: `${vanityBase}-${args.aliasWorkosUserId.slice(-6).toLowerCase()}`,
        isPaid: args.aliasIsPaid,
        createdAt: Date.now(),
      });
      aliasRow = (await ctx.db.get(id))!;
    } else {
      await ctx.db.patch(aliasRow._id, {
        workosUserId: args.aliasWorkosUserId,
        isPaid: args.aliasIsPaid,
      });
    }

    // Move named headings from the primary to the alias account.
    if (args.moveHeadingNames) {
      for (const name of args.moveHeadingNames) {
        const row = await ctx.db
          .query("subjectHeadings")
          .withIndex("by_owner", (q) => q.eq("ownerId", primary._id))
          .filter((q) => q.eq(q.field("heading"), name))
          .unique();
        if (row) await ctx.db.patch(row._id, { ownerId: aliasRow._id });
      }
    }

    // Primary: re-point WorkOS id when provided (one account = one email).
    await ctx.db.patch(primary._id, {
      workosUserId: args.primaryNewWorkosUserId ?? primary.workosUserId,
    });
    return null;
  },
});
