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

/**
 * Merge a duplicate account row into a primary row (e.g. two addresses for
 * the same human). Re-points the WorkOS id, unions aliases, moves owned
 * content (headings, faqs, events, theme) and deletes the alias row.
 * Idempotent for already-merged inputs.
 */
export const mergeUsersByAlias = internalMutation({
  args: { primaryEmail: v.string(), aliasEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const primaryEmail = args.primaryEmail.toLowerCase();
    const aliasEmail = args.aliasEmail.toLowerCase();
    if (primaryEmail === aliasEmail) return;

    const primary = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", primaryEmail))
      .unique();
    const alias = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", aliasEmail))
      .unique();
    if (!primary || !alias) return;

    // Move owned content.
    for (const table of ["subjectHeadings", "faqs", "events", "themeSettings"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_owner", (q) => q.eq("ownerId", alias._id))
        .collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, { ownerId: primary._id });
      }
    }

    // Union aliases (including the alias row's own aliases), keep the
    // primary's adminRole/isPaid advantage, adopt the alias's real WorkOS id
    // when the primary still has a placeholder.
    const aliases = [
      ...new Set([
        ...(primary.aliases ?? []),
        aliasEmail,
        ...(alias.aliases ?? []),
      ]),
    ];
    const realWorkosId =
      alias.workosUserId.startsWith("migrated:") || primary.workosUserId === alias.workosUserId
        ? primary.workosUserId
        : alias.workosUserId;

    await ctx.db.patch(primary._id, {
      aliases,
      workosUserId: realWorkosId,
      isPaid: primary.isPaid || alias.isPaid,
      adminRole:
        alias.adminRole === "super_admin" ? "super_admin" : primary.adminRole,
      displayName: primary.displayName ?? alias.displayName,
    });
    await ctx.db.delete(alias._id);
  },
});
