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
        aliases: v.optional(v.array(v.string())),
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

    // Pass 1: register alias -> primary mappings so alias rows are skipped.
    const aliasToPrimary = new Map<string, string>();
    for (const u of args.users) {
      for (const alias of u.aliases ?? []) {
        aliasToPrimary.set(alias.toLowerCase(), u.email.toLowerCase());
      }
    }

    for (const u of args.users) {
      const email = u.email.toLowerCase();
      if (aliasToPrimary.has(email) && aliasToPrimary.get(email) !== email) {
        continue; // this row merges into its primary
      }
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          displayName: u.displayName ?? existing.displayName,
          isPaid: existing.isPaid || u.isPaid,
          aliases: u.aliases ?? existing.aliases,
          adminRole:
            u.adminRole === "super_admin" ? "super_admin" : existing.adminRole,
        });
        emailToId.set(email, existing._id);
      } else {
        const adminRole =
          u.adminRole === "super_admin" ||
          u.adminRole === "admin" ||
          u.adminRole === "moderator"
            ? u.adminRole
            : undefined;
        const id = await ctx.db.insert("users", {
          email,
          workosUserId: `migrated:${email}`,
          vanityName: u.vanityName,
          displayName: u.displayName,
          isPaid: u.isPaid,
          aliases: u.aliases,
          adminRole,
          createdAt: Date.now(),
        });
        emailToId.set(email, id);
      }
    }

    // Alias emails resolve to their primary's id.
    for (const [alias, primary] of aliasToPrimary.entries()) {
      const primaryId = emailToId.get(primary);
      if (primaryId) emailToId.set(alias, primaryId);
    }

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
