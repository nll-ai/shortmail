export type BillingUserPatch = {
  isPaid?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  foundingPriceLocked?: boolean;
  stripeCompKind?: "lifetime" | "one_year";
  stripeCurrentPeriodEnd?: number;
  stripeCancelAtPeriodEnd?: boolean;
};

export class PaidStatusInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaidStatusInvariantError";
  }
}

/**
 * Enforces: `isPaid: true` requires Stripe customer and subscription ids.
 */
export function assertPaidInvariant(
  patch: BillingUserPatch,
  existing: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): void {
  if (patch.isPaid !== true) return;

  const customerId = patch.stripeCustomerId ?? existing.stripeCustomerId;
  const subscriptionId =
    patch.stripeSubscriptionId ?? existing.stripeSubscriptionId;

  if (!customerId || !subscriptionId) {
    throw new PaidStatusInvariantError(
      "isPaid=true requires stripeCustomerId and stripeSubscriptionId",
    );
  }
}

/**
 * Merge a billing patch and validate paid invariants before writing.
 */
export function buildBillingUserPatch(
  patch: BillingUserPatch,
  existing: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): BillingUserPatch {
  assertPaidInvariant(patch, existing);
  return patch;
}
