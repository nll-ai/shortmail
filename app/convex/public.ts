import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { bump, utcDay } from "./lib/rateLimit";
import { DAILY_SEND_CAP_DEFAULT } from "./lib/identity";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Public config for the hosted /send page and the embed widget.
 * Returns null for an unknown vanity (the httpAction maps that to 404).
 */
export const configForVanity = internalQuery({
  args: { vanity: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_vanity", (q) => q.eq("vanityName", args.vanity))
      .unique();
    if (!user) return null;

    const [headings, faqs] = await Promise.all([
      ctx.db
        .query("subjectHeadings")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      ctx.db
        .query("faqs")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
    ]);

    return {
      vanityName: user.vanityName,
      displayName: user.displayName ?? user.email,
      headings: headings.map((h) => h.heading),
      faqs: faqs.map((f) => ({ question: f.question, answer: f.answer })),
      theme: await (async () => {
        const settings = await ctx.db
          .query("themeSettings")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .unique();
        return settings
          ? { preset: settings.preset, customCss: settings.customCss ?? null }
          : null;
      })(),
      isPaid: user.isPaid,
    };
  },
});

export type SubmitSendResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "daily_cap_exceeded" };

/**
 * DB side of the send flow, called from the /api/send httpAction after the
 * HTTP-level validation (honeypot, email shape, message length) passed.
 *
 * Per plan §7 the enforced limit is the per-vanity daily cap; the per-IP
 * window is advisory only (x-forwarded-for is attacker-controlled on
 * *.convex.site) — its result is deliberately ignored.
 */
export const submitSend = internalMutation({
  args: {
    vanity: v.string(),
    senderName: v.string(),
    senderEmail: v.string(),
    subject: v.string(), // final subject incl. [RN]/[NRN] tag
    html: v.string(),
    text: v.string(),
    ip: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args): Promise<SubmitSendResult> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_vanity", (q) => q.eq("vanityName", args.vanity))
      .unique();
    if (!user) return { ok: false, reason: "user_not_found" };

    // Advisory per-IP window (5/hour): recorded, never blocks.
    if (args.ip) {
      await bump(ctx, `send:${args.ip}`, HOUR_MS, 5);
    }

    const cap = await bump(
      ctx,
      `cap:${args.vanity}:${utcDay()}`,
      null,
      DAILY_SEND_CAP_DEFAULT,
    );
    if (!cap.ok) return { ok: false, reason: "daily_cap_exceeded" };

    await ctx.scheduler.runAfter(0, internal.emails.sendShortmailEmail, {
      ownerId: user._id,
      to: user.email,
      replyTo: args.senderEmail,
      subject: args.subject,
      html: args.html,
      text: args.text,
      idempotencyKey: args.idempotencyKey,
    });

    return { ok: true };
  },
});

/**
 * Event write used by the email action (`send_success` after a Resend 2xx).
 * P4 builds the collector + read side on top of this row shape.
 */
export const recordEvent = internalMutation({
  args: {
    ownerId: v.id("users"),
    type: v.union(v.literal("form_view"), v.literal("send_success")),
    subject: v.optional(v.string()),
    path: v.optional(v.string()),
    ref: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      ownerId: args.ownerId,
      type: args.type,
      day: utcDay(),
      ts: Date.now(),
      subject: args.subject,
      path: args.path,
      ref: args.ref,
    });
  },
});
