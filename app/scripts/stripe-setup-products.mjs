#!/usr/bin/env node
/**
 * Idempotent ShortMail Premium products/prices (test or live) for Stripe.
 *
 * Requires STRIPE_SECRET_KEY in the environment. Uses lookup keys:
 * - shortmail_premium_yearly ($48/year)
 * - shortmail_premium_founding_yearly ($36/year)
 */
import Stripe from "stripe";

const LOOKUP_PREMIUM = "shortmail_premium_yearly";
const LOOKUP_FOUNDING = "shortmail_premium_founding_yearly";
const STATEMENT_DESCRIPTOR = "SHORTMAIL";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}

const stripe = new Stripe(key);

async function ensureProduct() {
  const search = await stripe.products.search({
    query: "metadata['shortmail_product']:'premium'",
    limit: 1,
  });
  if (search.data[0]) {
    return search.data[0];
  }
  return stripe.products.create({
    name: "ShortMail Premium",
    statement_descriptor: STATEMENT_DESCRIPTOR,
    metadata: { shortmail_product: "premium" },
  });
}

async function ensurePrice(productId, lookupKey, cents) {
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (listed.data[0]) {
    return listed.data[0];
  }
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: cents,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    recurring: { interval: "year" },
    tax_behavior: "exclusive",
  });
}

const product = await ensureProduct();
const standard = await ensurePrice(product.id, LOOKUP_PREMIUM, 4800);
const founding = await ensurePrice(product.id, LOOKUP_FOUNDING, 3600);

console.log(
  JSON.stringify(
    {
      productId: product.id,
      standardPriceId: standard.id,
      foundingPriceId: founding.id,
      lookupKeys: [LOOKUP_PREMIUM, LOOKUP_FOUNDING],
    },
    null,
    2,
  ),
);
