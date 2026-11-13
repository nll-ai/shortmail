import type Stripe from "stripe";
import { subscriptionGrantsPremium } from "../billing/subscriptionPaid";

export type StripeSyncPayload = {
  eventId: string;
  eventType: string;
  userId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  useFoundingPrice?: boolean;
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
      return {
        ...base,
        stripeCustomerId: customerId(sub.customer),
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
      };
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return {
        ...base,
        stripeCustomerId: customerId(sub.customer),
        stripeSubscriptionId: sub.id,
        subscriptionStatus: "canceled",
      };
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
