# Comping ShortMail Premium (Stripe)

Premium status (`users.isPaid`) is **only** written by `billing.syncFromStripeEvent` after Checkout, Customer Portal changes, or webhooks. Admins must not toggle `isPaid` in Convex.

## Coupons (create via setup script)

Run once per Stripe mode (test/live):

```bash
cd app && STRIPE_SECRET_KEY=sk_… node scripts/stripe-setup-products.mjs
```

This ensures:

| Coupon ID | Meaning | Stripe shape |
|---|---|---|
| `shortmail_comp_lifetime` | Free for life | 100% off, `duration=forever` |
| `shortmail_comp_1yr` | Free for one year | 100% off, `duration=once` on the yearly Premium price |

## Admin UI

**Admin → User management → Comp Premium** creates a Stripe subscription with the chosen coupon on the user’s customer (creating a customer first if needed).

- **Free for life** — subscription stays active at $0 until canceled.
- **Free for one year** — first year is $0 via `shortmail_comp_1yr`. After the period ends:
  - If the customer has a **real payment method** on file, the subscription **renews at the normal yearly price** (`cancel_at_period_end=false`).
  - If they **do not** have a card, **`cancel_at_period_end=true`** so they return to the free tier after one year unless they add a card before renewal.

The table shows **comp type** and **period end** (`stripeCompKind`, `stripeCurrentPeriodEnd`, `stripeCancelAtPeriodEnd`).

## Legacy `isPaid` without Stripe

Users with `isPaid=true` but missing `stripeCustomerId` / `stripeSubscriptionId` are invalid under the new invariant.

### Dry-run (default)

Lists affected users as JSON — no Stripe or Convex writes beyond the read:

```bash
cd app
export BILLING_INTERNAL_SECRET=… NEXT_PUBLIC_CONVEX_URL=…
npm run billing:legacy-migrate
# or: npx tsx scripts/billing-legacy-paid-migrate.ts
```

Moderators can also use Convex query `billing:legacyPaidWithoutStripeReport` from the dashboard.

### Apply via Stripe (opt-in)

**Do not run against production.** Requires test-mode Stripe and an explicit confirmation env:

```bash
cd app
export STRIPE_SECRET_KEY=sk_test_…
export BILLING_INTERNAL_SECRET=…
export NEXT_PUBLIC_CONVEX_URL=…   # preview/dev deployment only
export SHORTMAIL_ALLOW_LEGACY_MIGRATE=1
npm run billing:legacy-migrate -- --apply
# optional: --kind one_year   (default: lifetime)
```

`--apply` refuses `sk_live_…` keys, refuses the production Convex deployment hostname, and comp each listed user using the same Stripe path as **Comp Premium** (default **lifetime**).
