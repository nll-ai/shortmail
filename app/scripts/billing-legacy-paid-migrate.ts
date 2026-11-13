#!/usr/bin/env npx tsx
/**
 * Dry-run (default) or opt-in Stripe comp for legacy `isPaid` users missing Stripe ids.
 *
 *   npx tsx scripts/billing-legacy-paid-migrate.ts [--apply] [--kind lifetime|one_year]
 *
 * Requires: STRIPE_SECRET_KEY (test mode for --apply), NEXT_PUBLIC_CONVEX_URL,
 * BILLING_INTERNAL_SECRET. Never run --apply against production.
 */
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { createCompSubscription, type CompKind } from "../shared/stripe/comp";
import { subscriptionToSyncPayload } from "../shared/stripe/webhook";
import { subscriptionCurrentPeriodEndMs } from "../shared/stripe/subscriptionPeriod";
import { syncStripeToConvex } from "../shared/billing/convexServer";

function parseArgs(argv: string[]): { apply: boolean; kind: CompKind } {
  let apply = false;
  let kind: CompKind = "lifetime";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--kind") {
      const raw = argv[++i];
      if (raw === "lifetime" || raw === "one_year") kind = raw;
      else throw new Error(`Unknown --kind ${raw ?? ""}`);
    } else if (arg.startsWith("--kind=")) {
      const raw = arg.slice("--kind=".length);
      if (raw === "lifetime" || raw === "one_year") kind = raw;
      else throw new Error(`Unknown --kind=${raw}`);
    }
  }
  return { apply, kind };
}

function assertSafeToApply(stripeKey: string): void {
  if (!stripeKey.startsWith("sk_test_")) {
    throw new Error("--apply requires STRIPE_SECRET_KEY in test mode (sk_test_…).");
  }
  if (process.env.SHORTMAIL_ALLOW_LEGACY_MIGRATE !== "1") {
    throw new Error(
      "Set SHORTMAIL_ALLOW_LEGACY_MIGRATE=1 to confirm legacy migration (not for production).",
    );
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  if (
    convexUrl.includes("hallowed-leopard") ||
    process.env.SHORTMAIL_CONVEX_PRODUCTION === "1"
  ) {
    throw new Error("Refusing --apply: production Convex deployment detected.");
  }
}

type LegacyRow = {
  id: Id<"users">;
  email: string;
  vanityName: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

async function main(): Promise<void> {
  const { apply, kind } = parseArgs(process.argv.slice(2));
  const secret = process.env.BILLING_INTERNAL_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !convexUrl) {
    throw new Error("BILLING_INTERNAL_SECRET and NEXT_PUBLIC_CONVEX_URL are required.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const users = (await client.mutation(api.billing.legacyPaidListForMigration, {
    secret,
  })) as LegacyRow[];

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        compKind: kind,
        count: users.length,
        users,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to comp listed users via Stripe.");
    return;
  }

  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is required for --apply.");
  assertSafeToApply(stripeKey);

  const stripe = new Stripe(stripeKey);
  for (const row of users) {
    let customerId = row.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: row.email,
        metadata: { shortmail_user_id: row.id },
      });
      customerId = customer.id;
      await client.mutation(api.billing.linkStripeCustomer, {
        secret,
        userId: row.id,
        stripeCustomerId: customerId,
      });
    }

    const subscription = await createCompSubscription(stripe, {
      customerId,
      userId: row.id,
      compKind: kind,
    });

    const syncId = `legacy_migrate_${subscription.id}_${Date.now()}`;
    await syncStripeToConvex(
      subscriptionToSyncPayload(
        syncId,
        "customer.subscription.updated",
        subscription,
        row.id,
      ),
    );

    console.log(
      `Comped ${row.email} (${row.id}) kind=${kind} sub=${subscription.id} periodEnd=${
        subscriptionCurrentPeriodEndMs(subscription) ?? "n/a"
      }`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
