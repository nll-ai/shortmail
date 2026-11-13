// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { subject: "billing-owner", email: "billing@example.com" };

function testDb() {
  return convexTest({ schema, modules });
}

describe("billing sync and founding eligibility", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      BILLING_INTERNAL_SECRET: "test-secret",
      STRIPE_BILLING_LAUNCH_AT: "2026-01-01T00:00:00Z",
      STRIPE_FOUNDING_CAP: "100",
      STRIPE_FOUNDING_WINDOW_DAYS: "90",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("reports founding eligible at launch when configured", async () => {
    const t = testDb();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-15T00:00:00Z"));
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "billing",
        isPaid: false,
        createdAt: 1,
      }),
    );
    const asOwner = t.withIdentity(OWNER);
    const status = await asOwner.query(api.billing.foundingStatus, {});
    expect(status.eligible).toBe(true);
    vi.restoreAllMocks();
  });

  it("syncs Stripe checkout into isPaid with idempotency", async () => {
    const t = testDb();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "billing",
        isPaid: false,
        createdAt: 1,
      }),
    );
    const asOwner = t.withIdentity(OWNER);

    const args = {
      secret: "test-secret",
      eventId: "evt_dup",
      eventType: "checkout.session.completed",
      userId,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      useFoundingPrice: true,
    };

    const first = await t.mutation(api.billing.syncFromStripeEvent, args);
    const second = await t.mutation(api.billing.syncFromStripeEvent, args);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const profile = await asOwner.query(api.billing.billingProfile, {});
    expect(profile).not.toBeNull();
    expect(profile?.isPaid).toBe(true);
    expect(profile?.foundingPriceLocked).toBe(true);
    expect(profile?.stripeCustomerId).toBe("cus_test");
  });

  it("syncs comp fields from Stripe subscription events", async () => {
    const t = testDb();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "billing",
        isPaid: false,
        createdAt: 1,
      }),
    );
    const asOwner = t.withIdentity(OWNER);

    await t.mutation(api.billing.syncFromStripeEvent, {
      secret: "test-secret",
      eventId: "evt_comp",
      eventType: "customer.subscription.updated",
      userId,
      stripeCustomerId: "cus_comp",
      stripeSubscriptionId: "sub_comp",
      subscriptionStatus: "active",
      stripeCompKind: "one_year",
      stripeCurrentPeriodEnd: 1_800_000_000_000,
      stripeCancelAtPeriodEnd: true,
    });

    const profile = await asOwner.query(api.billing.billingProfile, {});
    expect(profile?.stripeCompKind).toBe("one_year");
    expect(profile?.stripeCurrentPeriodEnd).toBe(1_800_000_000_000);
    expect(profile?.stripeCancelAtPeriodEnd).toBe(true);
  });

  it("rejects isPaid true without stripe ids", async () => {
    const t = testDb();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "billing",
        isPaid: false,
        createdAt: 1,
      }),
    );

    await expect(
      t.mutation(api.billing.syncFromStripeEvent, {
        secret: "test-secret",
        eventId: "evt_bad",
        eventType: "customer.subscription.updated",
        userId,
        subscriptionStatus: "active",
      }),
    ).rejects.toThrow();
  });

  it("prepareCheckout chooses founding price while eligible", async () => {
    const t = testDb();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-15T00:00:00Z"));
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "billing",
        isPaid: false,
        createdAt: 1,
      }),
    );
    const asOwner = t.withIdentity(OWNER);
    const checkout = await asOwner.mutation(api.billing.prepareCheckout, {});
    expect(checkout.useFoundingPrice).toBe(true);
  });
});
