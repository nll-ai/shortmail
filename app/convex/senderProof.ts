import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { isDisposableEmail } from "./lib/disposableDomains";
import { bump, utcDay } from "./lib/rateLimit";
import {
  ADDRESS_COOLDOWN_MS,
  ADDRESS_DAILY_MAX,
  CONFIRM_ATTEMPT_MAX,
  GLOBAL_DAILY_MAX,
  LINK_TTL_MS,
  POLL_MAX,
  POLL_WINDOW_MS,
  confirmTransition,
  emailLooksValid,
  normalizeSenderEmail,
  pollStatus,
  sessionAllowsSend,
  sha256Hex,
  shouldSendVerification,
  type ProofRow,
} from "./lib/senderProof";
import type { Doc } from "./_generated/dataModel";

const HEX_64 = /^[0-9a-f]{64}$/;

function toRow(doc: Doc<"senderProofs">): ProofRow {
  return {
    challengeId: doc.challengeId,
    emailHash: doc.emailHash,
    challengeSecretHash: doc.challengeSecretHash,
    sessionSecretHash: doc.sessionSecretHash,
    verifyTokenHash: doc.verifyTokenHash,
    createdAt: doc.createdAt,
    linkExpiresAt: doc.linkExpiresAt,
    confirmedAt: doc.confirmedAt,
    sessionExpiresAt: doc.sessionExpiresAt,
  };
}

async function deleteExpired(ctx: MutationCtx, now: number): Promise<void> {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const old = await ctx.db
    .query("senderProofs")
    .withIndex("by_link_expiry", (q) => q.lt("linkExpiresAt", cutoff))
    .take(25);
  for (const row of old) {
    if (row.sessionExpiresAt === null || row.sessionExpiresAt < now) {
      await ctx.db.delete(row._id);
    }
  }
}

/**
 * Record a confirmation request. Returns whether a message may be sent.
 * The raw verification token never enters the database.
 */
export const beginVerification = internalMutation({
  args: {
    email: v.string(),
    challengeId: v.string(),
    challengeSecretHash: v.string(),
    sessionSecretHash: v.string(),
    verifyTokenHash: v.string(),
    originConfigured: v.boolean(),
  },
  returns: v.object({ deliver: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    await deleteExpired(ctx, now);
    const email = normalizeSenderEmail(args.email);
    const hashesOk =
      HEX_64.test(args.challengeSecretHash) &&
      HEX_64.test(args.sessionSecretHash) &&
      HEX_64.test(args.verifyTokenHash) &&
      args.challengeId.length >= 22 &&
      args.challengeId.length <= 128;
    if (
      !shouldSendVerification({
        emailLooksValid: emailLooksValid(email) && hashesOk,
        disposable: isDisposableEmail(email),
        addressCooldownOk: true,
        addressDailyOk: true,
        globalOk: true,
        originConfigured: args.originConfigured,
      })
    ) {
      return { deliver: false };
    }
    const emailHash = await sha256Hex(email);
    const addressCooldown = await bump(
      ctx,
      `verify:cool:${emailHash}`,
      ADDRESS_COOLDOWN_MS,
      1,
    );
    if (!addressCooldown.ok) return { deliver: false };
    const addressDaily = await bump(
      ctx,
      `verify:addr:${emailHash}:${utcDay(now)}`,
      null,
      ADDRESS_DAILY_MAX,
    );
    if (!addressDaily.ok) return { deliver: false };
    const global = await bump(
      ctx,
      `verify:global:${utcDay(now)}`,
      null,
      GLOBAL_DAILY_MAX,
    );
    if (!global.ok) return { deliver: false };

    const existing = await ctx.db
      .query("senderProofs")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .unique();
    if (existing) return { deliver: false };

    await ctx.db.insert("senderProofs", {
      challengeId: args.challengeId,
      emailHash,
      challengeSecretHash: args.challengeSecretHash,
      sessionSecretHash: args.sessionSecretHash,
      verifyTokenHash: args.verifyTokenHash,
      createdAt: now,
      linkExpiresAt: now + LINK_TTL_MS,
      confirmedAt: null,
      sessionExpiresAt: null,
    });
    return { deliver: true };
  },
});

/**
 * Tell the initiating browser whether its own challenge is still pending.
 */
export const pollVerification = internalMutation({
  args: {
    challengeId: v.string(),
    challengeSecret: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("expired"),
    ),
  }),
  handler: async (ctx, args) => {
    const limited = await bump(
      ctx,
      `verify:poll:${args.challengeId}`,
      POLL_WINDOW_MS,
      POLL_MAX,
    );
    if (!limited.ok) return { status: "pending" as const };
    const secretHash = await sha256Hex(args.challengeSecret);
    const doc = await ctx.db
      .query("senderProofs")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .unique();
    return { status: pollStatus(doc ? toRow(doc) : null, secretHash, Date.now()) };
  },
});

/**
 * Confirm a code for the browser that started it. Does not return a session secret.
 */
export const confirmVerification = internalMutation({
  args: {
    token: v.string(),
    challengeId: v.string(),
    challengeSecret: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("confirmed"),
      v.literal("expired"),
      v.literal("invalid"),
      v.literal("mismatch"),
    ),
    sessionExpiresAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const limited = await bump(
      ctx,
      `verify:confirm:${args.challengeId}`,
      LINK_TTL_MS,
      CONFIRM_ATTEMPT_MAX,
    );
    if (!limited.ok) {
      return { status: "invalid" as const, sessionExpiresAt: null };
    }
    const tokenHash = await sha256Hex(args.token.trim());
    const secretHash = await sha256Hex(args.challengeSecret);
    const doc = await ctx.db
      .query("senderProofs")
      .withIndex("by_verify_token", (q) => q.eq("verifyTokenHash", tokenHash))
      .unique();
    if (doc && doc.challengeId !== args.challengeId) {
      return { status: "mismatch" as const, sessionExpiresAt: null };
    }
    const result = confirmTransition(
      doc ? toRow(doc) : null,
      tokenHash,
      secretHash,
      Date.now(),
    );
    if (!result.ok) {
      return { status: result.reason, sessionExpiresAt: null };
    }
    if (doc && doc.confirmedAt === null) {
      await ctx.db.patch(doc._id, {
        confirmedAt: result.row.confirmedAt,
        sessionExpiresAt: result.row.sessionExpiresAt,
      });
    }
    return {
      status: "confirmed" as const,
      sessionExpiresAt: result.row.sessionExpiresAt,
    };
  },
});

/**
 * Whether this session secret may send as this address right now.
 */
export async function sessionIsLive(
  ctx: MutationCtx,
  senderEmail: string,
  sessionSecret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!sessionSecret) return false;
  const emailHash = await sha256Hex(normalizeSenderEmail(senderEmail));
  const sessionHash = await sha256Hex(sessionSecret);
  const doc = await ctx.db
    .query("senderProofs")
    .withIndex("by_session", (q) => q.eq("sessionSecretHash", sessionHash))
    .unique();
  return sessionAllowsSend(doc ? toRow(doc) : null, emailHash, sessionHash, now);
}
