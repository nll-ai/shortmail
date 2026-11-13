import type Stripe from "stripe";

/**
 * Resolve subscription period end in milliseconds (Stripe API versions differ).
 */
export function subscriptionCurrentPeriodEndMs(
  sub: Stripe.Subscription,
): number | undefined {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  if (fromItem) return fromItem * 1000;
  const legacy = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return legacy ? legacy * 1000 : undefined;
}
