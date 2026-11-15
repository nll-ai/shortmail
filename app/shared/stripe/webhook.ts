import type Stripe from "stripe";
import { subscriptionGrantsPremium } from "../billing/subscriptionPaid";
import type { CompKind } from "./comp";
import { subscriptionCurrentPeriodEndMs } from "./subscriptionPeriod";

export type StripeSyncPayload = {
  eventId: string;
  eventType: string;
  userId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  useFoundingPrice?: boolean;
  stripeCompKind?: CompKind;
  stripeCurrentPeriodEnd?: number;
  stripeCancelAtPeriodEnd?: boolean;
};

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | undefined {
  if (!customer) return undefined;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return undefined;
  return customer.id;
}

function subscriptionId(sub: string | Stripe.Subscription | null): string | undefined {
  if (!sub) return undefined;
  return typeof sub === "string" ? sub : sub.id;
}

function subscriptionStatus(sub: string | Stripe.Subscription | null): string | undefined {
  if (!sub || typeof sub === "string") return undefined;
  return sub.status;
}

function compKind(sub: Stripe.Subscription): CompKind | undefined {
  const raw = sub.metadata?.shortmail_comp_kind;
  if (raw === "lifetime" || raw === "one_year") return raw;
  return undefined;
}

function periodEnd(sub: Stripe.Subscription): number | undefined {
  return subscriptionCurrentPeriodEndMs(sub);
}

function syncFromSubscription(sub: Stripe.Subscription, base: StripeSyncPayload): StripeSyncPayload {
  return {
    ...base,
    stripeCustomerId: customerId(sub.customer),
    stripeSubscriptionId: sub.id,
    subscriptionStatus: sub.status,
    stripeCompKind: compKind(sub),
    stripeCurrentPeriodEnd: periodEnd(sub),
    stripeCancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/**
 * Map a verified Stripe event to a Convex billing sync payload.
 */
export function eventToSyncPayload(event: Stripe.Event): StripeSyncPayload | null {
  const base = { eventId: event.id, eventType: event.type };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.shortmail_user_id;
      const founding = session.metadata?.shortmail_founding_price === "true";
      const subId = subscriptionId(session.subscription);
      return {
        ...base,
        userId,
        stripeCustomerId: customerId(session.customer),
        stripeSubscriptionId: subId,
        subscriptionStatus: subId ? "active" : undefined,
        useFoundingPrice: founding,
      };
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      return syncFromSubscription(sub, base);
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return syncFromSubscription(sub, { ...base, subscriptionStatus: "canceled" });
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const sub =
        "subscription" in invoice
          ? (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null })
              .subscription
          : null;
      const status =
        typeof sub === "object" && sub ? sub.status : "past_due";
      return {
        ...base,
        stripeCustomerId: customerId(invoice.customer),
        stripeSubscriptionId: subscriptionId(sub ?? null),
        subscriptionStatus: subscriptionGrantsPremium(status) ? status : "past_due",
      };
    }
    default:
      return null;
  }
}

/**
 * Build a sync payload from a Stripe subscription (comp API immediate sync).
 */
export function subscriptionToSyncPayload(
  eventId: string,
  eventType: string,
  sub: Stripe.Subscription,
  userId: string,
): StripeSyncPayload {
  return syncFromSubscription(sub, {
    eventId,
    eventType,
    userId,
    subscriptionStatus: sub.status,
  });
}
