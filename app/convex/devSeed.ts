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
