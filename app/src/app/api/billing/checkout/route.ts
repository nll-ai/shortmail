import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { convexServerClient } from "../../../../../shared/billing/convexServer";
import { resolvePriceId, siteOrigin, stripeClient } from "../../../../../shared/stripe/server";

export const runtime = "nodejs";

/**
 * Start a Stripe Checkout Session for ShortMail Premium (annual).
 */
export async function POST(request: Request) {
  const session = await withAuth({ ensureSignedIn: true });
  if (!session.user || !session.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = session.accessToken;

  try {
    const client = convexServerClient(token);
    const checkout = await client.mutation(api.billing.prepareCheckout, {});

    const stripe = stripeClient();
    const priceId = await resolvePriceId(stripe, checkout.useFoundingPrice);
    const origin = siteOrigin(request.url);

    let customerId = checkout.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: checkout.email,
        metadata: { shortmail_user_id: checkout.userId },
      });
      customerId = customer.id;
      const secret = process.env.BILLING_INTERNAL_SECRET;
      if (secret && process.env.NEXT_PUBLIC_CONVEX_URL) {
        const bare = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
        await bare.mutation(api.billing.linkStripeCustomer, {
          secret,
          userId: checkout.userId,
          stripeCustomerId: customerId,
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: checkout.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/dashboard?billing=canceled`,
      allow_promotion_codes: false,
      metadata: {
        shortmail_user_id: checkout.userId,
        shortmail_founding_price: checkout.useFoundingPrice ? "true" : "false",
      },
      subscription_data: {
        metadata: {
          shortmail_user_id: checkout.userId,
          shortmail_founding_price: checkout.useFoundingPrice ? "true" : "false",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      url: session.url,
      useFoundingPrice: checkout.useFoundingPrice,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ALREADY_PAID")) {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
