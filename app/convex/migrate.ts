import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * One-shot importer for data migrated from the legacy SQLite database
 * (users / subject_headings / faqs). Idempotent: upserts by email.
 *
 * Users are created with a placeholder workosUserId (`migrated:<email>`);
 * `getOrCreateCurrentUser` adopts these rows on each person's first login
 * (matches by email or alias email, stamps the real WorkOS id, preserves
 * isPaid/adminRole).
 *
 * Known email aliases (e.g. two rows in the legacy DB for the same human)
 * are expressed via `aliases` on the primary user: content mapped to an
 * alias email lands on the primary row and no separate row is created.
 *
 * Run against a deployment with:
 *   npx convex run migrate:importSqlite "$(cat /tmp/shortmail-migration/migration-data.json)"
 */
export const importSqlite = internalMutation({
  args: {
    users: v.array(
      v.object({
        email: v.string(),
        vanityName: v.string(),
        displayName: v.optional(v.string()),
        isPaid: v.boolean(),
        adminRole: v.optional(v.string()),
      }),
    ),
    subjectHeadings: v.array(
      v.object({ email: v.string(), heading: v.string() }),
    ),
    faqs: v.array(
      v.object({
        email: v.string(),
        question: v.string(),
        answer: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const emailToId = new Map<string, Id<"users">>();

    for (const h of args.subjectHeadings) {
      const ownerId = emailToId.get(h.email.toLowerCase());
      if (!ownerId) throw new Error(`heading for unknown user ${h.email}`);
      await ctx.db.insert("subjectHeadings", { ownerId, heading: h.heading });
    }

    for (const f of args.faqs) {
      const ownerId = emailToId.get(f.email.toLowerCase());
      if (!ownerId) throw new Error(`faq for unknown user ${f.email}`);
      await ctx.db.insert("faqs", {
        ownerId,
        question: f.question,
        answer: f.answer,
      });
    }
  },
});
