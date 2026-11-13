import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { eventToSyncPayload } from "./webhook";

describe("eventToSyncPayload", () => {
  it("maps checkout.session.completed with founding metadata", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_123",
          subscription: "sub_456",
          metadata: {
            shortmail_user_id: "user_abc",
            shortmail_founding_price: "true",
          },
        },
      },
    } as unknown as Stripe.Event;

    const payload = eventToSyncPayload(event);
    expect(payload).toMatchObject({
      eventId: "evt_1",
      userId: "user_abc",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      subscriptionStatus: "active",
      useFoundingPrice: true,
    });
  });

  it("maps subscription.updated with comp metadata", () => {
    const event = {
      id: "evt_comp",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_comp",
          customer: "cus_123",
          status: "active",
          cancel_at_period_end: true,
          current_period_end: 1_800_000_000,
          metadata: { shortmail_comp_kind: "one_year" },
        },
      },
    } as unknown as Stripe.Event;

    expect(eventToSyncPayload(event)).toMatchObject({
      stripeCompKind: "one_year",
      stripeCancelAtPeriodEnd: true,
      stripeCurrentPeriodEnd: 1_800_000_000_000,
    });
  });

  it("maps subscription deletion to canceled", () => {
    const event = {
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_123",
          status: "canceled",
        },
      },
    } as unknown as Stripe.Event;

    expect(eventToSyncPayload(event)?.subscriptionStatus).toBe("canceled");
  });
});
