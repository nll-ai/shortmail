/**
 * Whether a Stripe subscription status should grant Premium (`isPaid`).
 */
export function subscriptionGrantsPremium(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return (
    normalized === "active" ||
    normalized === "trialing" ||
    normalized === "past_due"
  );
}
