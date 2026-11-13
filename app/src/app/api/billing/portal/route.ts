import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { convexServerClient } from "../../../../../shared/billing/convexServer";
import { siteOrigin, stripeClient } from "../../../../../shared/stripe/server";

export const runtime = "nodejs";

/**
 * Stripe Customer Portal — manage or cancel Premium.
 */
export async function POST(request: Request) {
  const auth = await withAuth({ ensureSignedIn: true });
  if (!auth.user || !auth.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = convexServerClient(auth.accessToken);
  const profile = await client.query(api.billing.billingProfile, {});
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const stripe = stripeClient();
  const origin = siteOrigin(request.url);
  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: portal.url });
}
