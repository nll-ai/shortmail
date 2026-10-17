import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  FREE_FAQ_LIMIT,
  FREE_HEADING_LIMIT,
  findUserByIdentity,
  normalizeVanity,
  requireUser,
} from "./lib/identity";

/**
 * Dashboard CRUD for subject headings and FAQs (parity with the legacy
 * /add_subject_heading, /remove_subject_heading, /add_faq, /edit_faq,
 * /remove_faq routes) plus vanity/display-name updates.
 * Free-tier limits: 5 headings, 3 FAQs (main.py:354-402 parity).
 */

// Reads are null-safe: during the brief first-login provisioning window the
// caller has no row yet — an empty list is the correct render, not an error
// (codebase-design F11 follow-up: first-login race, verified on prod).
export const myHeadings = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUserByIdentity(ctx);
    if (!user) return [];
    return ctx.db
      .query("subjectHeadings")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

export const myFaqs = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUserByIdentity(ctx);
    if (!user) return [];
    return ctx.db
      .query("faqs")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

export const addSubjectHeading = mutation({
  args: { heading: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const heading = args.heading.trim();
    if (!heading) throw new ConvexError("heading_required");

    if (!user.isPaid) {
      const existing = await ctx.db
        .query("subjectHeadings")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      if (existing.length >= FREE_HEADING_LIMIT) {
        throw new ConvexError("FREE_LIMIT_REACHED");
      }
    }
    await ctx.db.insert("subjectHeadings", {
      ownerId: user._id,
      heading,
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

    if (!user.isPaid) {
      const existing = await ctx.db
        .query("faqs")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      if (existing.length >= FREE_FAQ_LIMIT) {
        throw new ConvexError("FREE_LIMIT_REACHED");
      }
    }
    await ctx.db.insert("faqs", {
      ownerId: user._id,
      question,
      answer,
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
