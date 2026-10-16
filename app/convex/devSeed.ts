import { internalMutation } from "./_generated/server";
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
