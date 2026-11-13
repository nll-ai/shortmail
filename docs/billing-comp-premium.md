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

Users with `isPaid=true` but missing `stripeCustomerId` / `stripeSubscriptionId` are invalid under the new invariant. Fix by comping them through the admin UI (or Checkout), not by patching Convex.

Dry-run report (no Stripe writes):

```bash
cd app && npx convex run billing:legacyPaidWithoutStripeReport
```

Review the printed list and grant Premium with **Comp Premium** per user (no automatic Stripe migration).
