import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { convexServerClient, syncStripeToConvex } from "../../../../../../shared/billing/convexServer";
import type { CompKind } from "../../../../../../shared/stripe/comp";
import { createCompSubscription } from "../../../../../../shared/stripe/comp";
import { subscriptionToSyncPayload } from "../../../../../../shared/stripe/webhook";
import { subscriptionCurrentPeriodEndMs } from "../../../../../../shared/stripe/subscriptionPeriod";
import { stripeClient } from "../../../../../../shared/stripe/server";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  compKind?: CompKind;
};

/**
 * Moderator+: grant Premium via a 100% Stripe subscription (webhook-authoritative).
 */
export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.user || !auth.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.userId || (body.compKind !== "lifetime" && body.compKind !== "one_year")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const client = convexServerClient(auth.accessToken);
  let target;
  try {
    target = await client.query(api.billing.compTargetForAdmin, {
      userId: body.userId as Id<"users">,
    });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (target.isPaid && target.stripeSubscriptionId) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  const stripe = stripeClient();
  let customerId = target.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: target.email,
      metadata: { shortmail_user_id: target.userId },
    });
    customerId = customer.id;
    const secret = process.env.BILLING_INTERNAL_SECRET;
    if (secret && process.env.NEXT_PUBLIC_CONVEX_URL) {
      const bare = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
      await bare.mutation(api.billing.linkStripeCustomer, {
        secret,
        userId: target.userId,
        stripeCustomerId: customerId,
      });
    }
  }

  const subscription = await createCompSubscription(stripe, {
    customerId,
    userId: target.userId,
    compKind: body.compKind,
  });

  const syncId = `comp_${subscription.id}_${Date.now()}`;
  await syncStripeToConvex(
    subscriptionToSyncPayload(syncId, "customer.subscription.updated", subscription, target.userId),
  );

  return NextResponse.json({
    ok: true,
    compKind: body.compKind,
    subscriptionId: subscription.id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscriptionCurrentPeriodEndMs(subscription) ?? null,
  });
}
