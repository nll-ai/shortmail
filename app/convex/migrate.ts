import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { sequentialPositions } from "./lib/order";

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

    const headingAt = new Map<string, number>();
    for (const h of args.subjectHeadings) {
      const email = h.email.toLowerCase();
      const ownerId = emailToId.get(email);
      if (!ownerId) throw new Error(`heading for unknown user ${h.email}`);
      const position = headingAt.get(email) ?? 0;
      headingAt.set(email, position + 1);
      await ctx.db.insert("subjectHeadings", { ownerId, heading: h.heading, position });
    }

    const faqAt = new Map<string, number>();
    for (const f of args.faqs) {
      const email = f.email.toLowerCase();
      const ownerId = emailToId.get(email);
      if (!ownerId) throw new Error(`faq for unknown user ${f.email}`);
      const position = faqAt.get(email) ?? 0;
      faqAt.set(email, position + 1);
      await ctx.db.insert("faqs", {
        ownerId,
        question: f.question,
        answer: f.answer,
        position,
      });
    }
  },
});

/**
 * Number every subject heading and FAQ that is still missing `position`,
 * or whose positions have gaps, without changing display order.
 *
 * Safe to run more than once. Documents that already use 0..n-1 in their
 * current order are left untouched, including an order that is not creation
 * order. Grouped by owner so one person's list does not share indexes with
 * another's.
 *
 *   npx convex run migrate:backfillListOrder '{}'
 */
export const backfillListOrder = internalMutation({
  args: {},
  returns: v.object({ headings: v.number(), faqs: v.number() }),
  handler: async (ctx) => {
    const headings = await backfillTable(ctx, "subjectHeadings");
    const faqs = await backfillTable(ctx, "faqs");
    return { headings, faqs };
  },
});

/**
 * Write sequential positions for one table, one owner at a time.
 *
 * :param ctx: Mutation context.
 * :param table: `subjectHeadings` or `faqs`.
 * :returns: How many documents were patched.
 */
async function backfillTable(
  ctx: MutationCtx,
  table: "subjectHeadings" | "faqs",
): Promise<number> {
  const rows = await ctx.db.query(table).collect();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = groups.get(row.ownerId) ?? [];
    group.push(row);
    groups.set(row.ownerId, group);
  }
  let writes = 0;
  for (const group of groups.values()) {
    const patches = sequentialPositions(
      group.map((row) => ({
        id: row._id,
        position: row.position,
        _creationTime: row._creationTime,
      })),
    );
    for (const patch of patches) {
      const row = group.find((candidate) => candidate._id === patch.id);
      if (!row) continue;
      await ctx.db.patch(row._id, { position: patch.position });
      writes += 1;
    }
  }
  return writes;
}
