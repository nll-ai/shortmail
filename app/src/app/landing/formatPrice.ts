/**
 * Format a yearly Stripe amount stored in cents for marketing copy.
 *
 * :param cents: Integer cents from shared billing config.
 * :returns: Dollar string without a “/year” suffix.
 */
export function formatYearlyDollars(cents: number): string {
  return `$${cents / 100}`;
}
