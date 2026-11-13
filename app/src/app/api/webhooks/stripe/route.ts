import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncStripeToConvex } from "../../../../../shared/billing/convexServer";
import { eventToSyncPayload } from "../../../../../shared/stripe/webhook";
import { stripeClient } from "../../../../../shared/stripe/server";

export const runtime = "nodejs";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/**
 * Stripe webhooks — verified, idempotent sync into Convex `isPaid`.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const payload = eventToSyncPayload(event);
  if (!payload) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    await syncStripeToConvex(payload);
  } catch {
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
