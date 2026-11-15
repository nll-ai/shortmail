import type Stripe from "stripe";
import { LOOKUP_KEY_PREMIUM_YEARLY } from "../billing/config";
import { resolvePriceId } from "./server";

export const COMP_COUPON_LIFETIME_ID = "shortmail_comp_lifetime";
export const COMP_COUPON_1YR_ID = "shortmail_comp_1yr";

export type CompKind = "lifetime" | "one_year";

export async function ensureCompCoupons(stripe: Stripe): Promise<void> {
  for (const spec of [
    {
      id: COMP_COUPON_LIFETIME_ID,
      name: "ShortMail comp — lifetime",
      duration: "forever" as const,
    },
    {
      id: COMP_COUPON_1YR_ID,
      name: "ShortMail comp — one year",
      duration: "once" as const,
    },
  ]) {
    try {
      await stripe.coupons.retrieve(spec.id);
    } catch {
      await stripe.coupons.create({
        id: spec.id,
        name: spec.name,
        percent_off: 100,
        duration: spec.duration,
      });
    }
  }
}

export async function customerHasPaymentMethod(
  stripe: Stripe,
  customerId: string,
): Promise<boolean> {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return false;
  const defaultPm = customer.invoice_settings?.default_payment_method;
  if (defaultPm && typeof defaultPm === "object") return true;
  if (typeof defaultPm === "string" && defaultPm.length > 0) return true;
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return methods.data.length > 0;
}

export async function createCompSubscription(
  stripe: Stripe,
  input: {
    customerId: string;
    userId: string;
    compKind: CompKind;
  },
): Promise<Stripe.Subscription> {
  await ensureCompCoupons(stripe);
  const priceId = await resolvePriceId(stripe, false);

  const couponId =
    input.compKind === "lifetime" ? COMP_COUPON_LIFETIME_ID : COMP_COUPON_1YR_ID;

  let cancelAtPeriodEnd = false;
  if (input.compKind === "one_year") {
    const hasPaymentMethod = await customerHasPaymentMethod(
      stripe,
      input.customerId,
    );
    cancelAtPeriodEnd = !hasPaymentMethod;
  }

  return stripe.subscriptions.create({
    customer: input.customerId,
    items: [{ price: priceId, quantity: 1 }],
    discounts: [{ coupon: couponId }],
    cancel_at_period_end: cancelAtPeriodEnd,
    metadata: {
      shortmail_user_id: input.userId,
      shortmail_comp_kind: input.compKind,
      shortmail_comp_coupon: couponId,
    },
    payment_settings: { save_default_payment_method: "off" },
  });
}
