import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function convexServerClient(accessToken: string): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  const client = new ConvexHttpClient(url);
  client.setAuth(accessToken);
  return client;
}

export async function syncStripeToConvex(payload: {
  eventId: string;
  eventType: string;
  userId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  useFoundingPrice?: boolean;
}): Promise<{ duplicate: boolean }> {
  const secret = process.env.BILLING_INTERNAL_SECRET;
  if (!secret) throw new Error("BILLING_INTERNAL_SECRET is not configured");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");

  const client = new ConvexHttpClient(url);
  const result = (await client.mutation(api.billing.syncFromStripeEvent, {
    secret,
    eventId: payload.eventId,
    eventType: payload.eventType,
    userId: payload.userId as Id<"users"> | undefined,
    stripeCustomerId: payload.stripeCustomerId,
    stripeSubscriptionId: payload.stripeSubscriptionId,
    subscriptionStatus: payload.subscriptionStatus,
    useFoundingPrice: payload.useFoundingPrice,
  })) as { duplicate: boolean };
  return result;
}
