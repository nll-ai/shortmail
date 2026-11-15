import Stripe from "stripe";
import {
  FOUNDING_CENTS_YEARLY,
  LOOKUP_KEY_FOUNDING_YEARLY,
  LOOKUP_KEY_PREMIUM_YEARLY,
  PREMIUM_CENTS_YEARLY,
} from "../billing/config";

export const STATEMENT_DESCRIPTOR = "SHORTMAIL";

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key);
}

export async function resolvePriceId(
  stripe: Stripe,
  useFoundingPrice: boolean,
): Promise<string> {
  const lookupKey = useFoundingPrice
    ? LOOKUP_KEY_FOUNDING_YEARLY
    : LOOKUP_KEY_PREMIUM_YEARLY;
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const existing = prices.data[0];
  if (existing) return existing.id;
  return ensurePrice(stripe, lookupKey, useFoundingPrice);
}

async function ensurePrice(
  stripe: Stripe,
  lookupKey: string,
  founding: boolean,
): Promise<string> {
  const product = await ensurePremiumProduct(stripe);
  const created = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: founding ? FOUNDING_CENTS_YEARLY : PREMIUM_CENTS_YEARLY,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    recurring: { interval: "year" },
    tax_behavior: "exclusive",
  });
  return created.id;
}

async function ensurePremiumProduct(stripe: Stripe): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['shortmail_product']:'premium'`,
    limit: 1,
  });
  const hit = existing.data[0];
  if (hit) return hit;

  return stripe.products.create({
    name: "ShortMail Premium",
    statement_descriptor: STATEMENT_DESCRIPTOR,
    metadata: { shortmail_product: "premium" },
  });
}

export function siteOrigin(requestUrl: string): string {
  const fromEnv = process.env.SHORTMAIL_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}
