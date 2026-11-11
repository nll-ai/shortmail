import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  FREE_FAQ_LIMIT,
  FREE_HEADING_LIMIT,
  findUserByIdentity,
  normalizeVanity,
  requireUser,
} from "./lib/identity";
import { planReorder, sequentialPositions, sortByOrder } from "./lib/order";

/**
 * Dashboard CRUD for subject headings and FAQs (parity with the legacy
 * /add_subject_heading, /remove_subject_heading, /add_faq, /edit_faq,
 * /remove_faq routes) plus vanity/display-name updates and list order.
 * Free-tier limits: 5 headings, 3 FAQs (main.py:354-402 parity).
 *
 * Reads return the owner's display order. Writes number `position` from 0
 * so a new row is last, and a reorder of one owner's rows is a single
 * transaction. A requested id that exists on another account is rejected
 * before any patch. An id that was deleted is skipped. A row this client
 * had not read yet stays, appended in its current order.
 */

// Reads are null-safe: during the brief first-login provisioning window the
// caller has no row yet — an empty list is the correct render, not an error
// (codebase-design F11 follow-up: first-login race, verified on prod).
export const myHeadings = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUserByIdentity(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("subjectHeadings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return sortByOrder(rows);
  },
});

export const myFaqs = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUserByIdentity(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("faqs")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return sortByOrder(rows);
  },
});

export const addSubjectHeading = mutation({
  args: { heading: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const heading = args.heading.trim();
    if (!heading) throw new ConvexError("heading_required");

    const existing = await ctx.db
      .query("subjectHeadings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (!user.isPaid && existing.length >= FREE_HEADING_LIMIT) {
      throw new ConvexError("FREE_LIMIT_REACHED");
    }
    const position = await normalizePositions(existing, async (id, next) => {
      const row = existing.find((candidate) => candidate._id === id);
      if (row) await ctx.db.patch(row._id, { position: next });
    });
    await ctx.db.insert("subjectHeadings", {
      ownerId: user._id,
      heading,
      position,
    });
  },
});

export const reorderSubjectHeadings = mutation({
  args: { ids: v.array(v.id("subjectHeadings")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const owned = await ctx.db
      .query("subjectHeadings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const ownedIds = new Set<string>(owned.map((row) => row._id));
    for (const id of args.ids) {
      if (ownedIds.has(id)) continue;
      const row = await ctx.db.get(id);
      if (row && row.ownerId !== user._id) throw new ConvexError("NOT_FOUND");
    }
    await reorderRows(owned, args.ids, async (id, position) => {
      const row = owned.find((candidate) => candidate._id === id);
      if (row) await ctx.db.patch(row._id, { position });
    });
  },
});

export const removeSubjectHeading = mutation({
  args: { id: v.id("subjectHeadings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id) throw new ConvexError("NOT_FOUND");
    await ctx.db.delete(args.id);
  },
});

export const addFaq = mutation({
  args: { question: v.string(), answer: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const question = args.question.trim();
    const answer = args.answer.trim();
    if (!question || !answer) throw new ConvexError("faq_fields_required");

    const existing = await ctx.db
      .query("faqs")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (!user.isPaid && existing.length >= FREE_FAQ_LIMIT) {
      throw new ConvexError("FREE_LIMIT_REACHED");
    }
    const position = await normalizePositions(existing, async (id, next) => {
      const row = existing.find((candidate) => candidate._id === id);
      if (row) await ctx.db.patch(row._id, { position: next });
    });
    await ctx.db.insert("faqs", {
      ownerId: user._id,
      question,
      answer,
      position,
    });
  },
});

export const reorderFaqs = mutation({
  args: { ids: v.array(v.id("faqs")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const owned = await ctx.db
      .query("faqs")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const ownedIds = new Set<string>(owned.map((row) => row._id));
    for (const id of args.ids) {
      if (ownedIds.has(id)) continue;
      const row = await ctx.db.get(id);
      if (row && row.ownerId !== user._id) throw new ConvexError("NOT_FOUND");
    }
    await reorderRows(owned, args.ids, async (id, position) => {
      const row = owned.find((candidate) => candidate._id === id);
      if (row) await ctx.db.patch(row._id, { position });
    });
  },
});

export const editFaq = mutation({
  args: {
    id: v.id("faqs"),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id) throw new ConvexError("NOT_FOUND");
    const question = args.question.trim();
    const answer = args.answer.trim();
    if (!question || !answer) throw new ConvexError("faq_fields_required");
    await ctx.db.patch(args.id, { question, answer });
  },
});

export const removeFaq = mutation({
  args: { id: v.id("faqs") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.ownerId !== user._id) throw new ConvexError("NOT_FOUND");
    await ctx.db.delete(args.id);
  },
});

export const updateVanityName = mutation({
  args: { vanityName: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user.isPaid) throw new ConvexError("PREMIUM_REQUIRED");

    const vanityName = normalizeVanity(args.vanityName);
    if (!vanityName) throw new ConvexError("vanity_invalid");

    const taken = await ctx.db
      .query("users")
      .withIndex("by_vanity", (q) => q.eq("vanityName", vanityName))
      .unique();
    if (taken && taken._id !== user._id) throw new ConvexError("vanity_taken");

    await ctx.db.patch(user._id, { vanityName });
  },
});

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const displayName = args.displayName.trim();
    if (!displayName) throw new ConvexError("display_name_required");
    await ctx.db.patch(user._id, { displayName });
  },
});

type OrderRow = {
  _id: string;
  position?: number;
  _creationTime: number;
};

/**
 * Number existing rows 0..n-1 in their current display order.
 *
 * :param rows: One owner's rows, in any order.
 * :param patch: Writes one position. Called only when it changed.
 * :returns: The position a newly inserted row should use (the end).
 */
async function normalizePositions(
  rows: readonly OrderRow[],
  patch: (id: string, position: number) => Promise<void>,
): Promise<number> {
  for (const write of sequentialPositions(
    rows.map((row) => ({
      id: row._id,
      position: row.position,
      _creationTime: row._creationTime,
    })),
  )) {
    await patch(write.id, write.position);
  }
  return rows.length;
}

/**
 * Replace display order. See the module comment for how missing and newly
 * inserted rows are treated. The caller has already rejected foreign ids.
 *
 * :param rows: The caller's current rows.
 * :param requestedIds: Client order. Deleted ids are ignored.
 * :param patch: Writes one position. Called only when it changed.
 */
async function reorderRows(
  rows: readonly OrderRow[],
  requestedIds: readonly string[],
  patch: (id: string, position: number) => Promise<void>,
): Promise<void> {
  const orderedIds = planReorder(
    rows.map((row) => ({
      id: row._id,
      position: row.position,
      _creationTime: row._creationTime,
    })),
    requestedIds,
  );
  for (let position = 0; position < orderedIds.length; position += 1) {
    const row = rows.find((candidate) => candidate._id === orderedIds[position]);
    if (!row || row.position === position) continue;
    await patch(row._id, position);
  }
}

