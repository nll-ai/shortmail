#!/usr/bin/env node
/**
 * Print legacy paid users (isPaid without full Stripe linkage).
 * Dry-run only — fix via Admin → Comp Premium (see docs/billing-comp-premium.md).
 *
 * Usage (authenticated Convex deployment):
 *   cd app && npx convex run billing:legacyPaidWithoutStripeReport
 *
 * This wrapper only echoes that command when CONVEX_DEPLOYMENT is unset.
 */
const deployment = process.env.CONVEX_DEPLOYMENT;
if (!deployment) {
  console.log(
    "Dry-run: list legacy paid users with:\n" +
      "  cd app && npx convex run billing:legacyPaidWithoutStripeReport\n",
  );
  console.log(
    "Sign in as a moderator+ in the app, or run against a deployment where your CLI identity has access.",
  );
  process.exit(0);
}

console.error(
  "Run: npx convex run billing:legacyPaidWithoutStripeReport",
);
process.exit(1);
