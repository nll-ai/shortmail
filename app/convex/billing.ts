import {
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { findUserByIdentity, getOrCreateCurrentUser } from "./lib/identity";
import { requireAdminRole, requireUser } from "./lib/identity";
import { foundingEligibility } from "../shared/billing/foundingEligibility";
import { readBillingConfig } from "../shared/billing/config";
import { subscriptionGrantsPremium } from "../shared/billing/subscriptionPaid";
import {
  buildBillingUserPatch,
  PaidStatusInvariantError,
  type BillingUserPatch,
} from "../shared/billing/paidPatch";

function verifyBillingSecret(secret: string | undefined): void {
  const expected = process.env.BILLING_INTERNAL_SECRET;
  if (!expected || !secret || secret !== expected) {
    throw new ConvexError("unauthorized");
  }
}

async function countFoundingCustomers(ctx: QueryCtx) {
  const paidFounding = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("foundingPriceLocked"), true))
    .collect();
  return paidFounding.length;
}

function compKindFromMetadata(
  raw: string | undefined,
): "lifetime" | "one_year" | undefined {
  if (raw === "lifetime" || raw === "one_year") return raw;
  return undefined;
}

function applyUserBillingPatch(user: Doc<"users">, patch: BillingUserPatch): void {
  try {
    buildBillingUserPatch(patch, {
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });
  } catch (error) {
    if (error instanceof PaidStatusInvariantError) {
      throw new ConvexError("PAID_INVARIANT");
    }
    throw error;
  }
}

export const foundingStatus = query({
  args: {},
  handler: async (ctx) => {
    const config = readBillingConfig(process.env);
    const count = await countFoundingCustomers(ctx);
    const status = foundingEligibility({
      config,
      nowMs: Date.now(),
      foundingCustomersCount: count,
    });
    return {
      ...status,
      foundingCustomersCount: count,
      foundingCap: config?.foundingCap ?? null,
    };
  },
});

export const billingProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await findUserByIdentity(ctx);
    if (!user) return null;
    return {
      isPaid: user.isPaid,
      stripeCustomerId: user.stripeCustomerId ?? null,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      stripeSubscriptionStatus: user.stripeSubscriptionStatus ?? null,
      foundingPriceLocked: user.foundingPriceLocked ?? false,
      stripeCompKind: user.stripeCompKind ?? null,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd ?? null,
      stripeCancelAtPeriodEnd: user.stripeCancelAtPeriodEnd ?? null,
    };
  },
});

export const prepareCheckout = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getOrCreateCurrentUser(ctx);
    if (user.isPaid && subscriptionGrantsPremium(user.stripeSubscriptionStatus)) {
      throw new ConvexError("ALREADY_PAID");
    }
    const config = readBillingConfig(process.env);
    const count = await countFoundingCustomers(ctx);
    const founding = foundingEligibility({
      config,
      nowMs: Date.now(),
      foundingCustomersCount: count,
    });
    return {
      userId: user._id,
      email: user.email,
      useFoundingPrice: founding.eligible,
      stripeCustomerId: user.stripeCustomerId ?? null,
    };
  },
});

export const linkStripeCustomer = mutation({
  args: {
    secret: v.string(),
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    verifyBillingSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("NOT_FOUND");
    if (user.stripeCustomerId && user.stripeCustomerId !== args.stripeCustomerId) {
      throw new ConvexError("CUSTOMER_MISMATCH");
    }
    if (!user.stripeCustomerId) {
      await ctx.db.patch(args.userId, { stripeCustomerId: args.stripeCustomerId });
    }
    return null;
  },
});

const syncArgs = {
  secret: v.string(),
  eventId: v.string(),
  eventType: v.string(),
  userId: v.optional(v.id("users")),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  subscriptionStatus: v.optional(v.string()),
  useFoundingPrice: v.optional(v.boolean()),
  stripeCompKind: v.optional(v.union(v.literal("lifetime"), v.literal("one_year"))),
  stripeCurrentPeriodEnd: v.optional(v.number()),
  stripeCancelAtPeriodEnd: v.optional(v.boolean()),
};

export const syncFromStripeEvent = mutation({
  args: syncArgs,
  handler: async (ctx, args) => {
    verifyBillingSecret(args.secret);

    const existing = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) {
      return { duplicate: true as const };
    }

    let user =
      args.userId != null ? await ctx.db.get(args.userId) : null;
    if (!user && args.stripeCustomerId) {
      user =
        (await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("stripeCustomerId"), args.stripeCustomerId))
          .first()) ?? null;
    }

    if (user) {
      const patch: BillingUserPatch = {};
      if (args.stripeCustomerId) patch.stripeCustomerId = args.stripeCustomerId;
      if (args.stripeSubscriptionId !== undefined) {
        patch.stripeSubscriptionId = args.stripeSubscriptionId;
      }
      if (args.subscriptionStatus !== undefined) {
        patch.stripeSubscriptionStatus = args.subscriptionStatus;
        patch.isPaid = subscriptionGrantsPremium(args.subscriptionStatus);
      }
      if (args.useFoundingPrice) {
        patch.foundingPriceLocked = true;
      }
      if (args.stripeCompKind) {
        patch.stripeCompKind = args.stripeCompKind;
      }
      if (args.stripeCurrentPeriodEnd !== undefined) {
        patch.stripeCurrentPeriodEnd = args.stripeCurrentPeriodEnd;
      }
      if (args.stripeCancelAtPeriodEnd !== undefined) {
        patch.stripeCancelAtPeriodEnd = args.stripeCancelAtPeriodEnd;
      }
      if (args.eventType === "customer.subscription.deleted") {
        patch.stripeSubscriptionStatus = "canceled";
        patch.isPaid = false;
      }
      if (Object.keys(patch).length > 0) {
        applyUserBillingPatch(user, patch);
        await ctx.db.patch(user._id, patch);
      }
    }

    await ctx.db.insert("stripeWebhookEvents", {
      eventId: args.eventId,
      type: args.eventType,
      processedAt: Date.now(),
    });

    return { duplicate: false as const };
  },
});

/** Moderator+ comp flow: load the target user for Stripe subscription creation. */
export const compTargetForAdmin = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireUser(ctx);
    requireAdminRole(admin, "moderator");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("NOT_FOUND");
    return {
      userId: user._id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId ?? null,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      isPaid: user.isPaid,
    };
  },
});

function legacyPaidRows(users: Doc<"users">[]) {
  return users
    .filter(
      (u) =>
        u.isPaid &&
        (!u.stripeCustomerId || !u.stripeSubscriptionId),
    )
    .map((u) => ({
      id: u._id,
      email: u.email,
      vanityName: u.vanityName,
      stripeCustomerId: u.stripeCustomerId ?? null,
      stripeSubscriptionId: u.stripeSubscriptionId ?? null,
    }));
}

export const listLegacyPaidWithoutStripe = internalQuery({
  args: {},
  handler: async (ctx) => legacyPaidRows(await ctx.db.query("users").collect()),
});

/** Moderator+ dry-run list of paid users missing Stripe linkage (see docs/billing-comp-premium.md). */
export const legacyPaidWithoutStripeReport = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireUser(ctx);
    requireAdminRole(admin, "moderator");
    return legacyPaidRows(await ctx.db.query("users").collect());
  },
});

export const countFoundingCustomersInternal = internalQuery({
  args: {},
  handler: async (ctx) => countFoundingCustomers(ctx),
});

export const getUserForBilling = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId ?? null,
    };
  },
});
