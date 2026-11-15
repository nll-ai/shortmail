export type CompKind = "lifetime" | "one_year";

export type CompPeriodInput = {
  stripeCompKind: CompKind | null;
  stripeCurrentPeriodEnd: number | null;
  stripeCancelAtPeriodEnd?: boolean | null;
};

const DEFAULT_YEARLY_PRICE_LABEL = "$48/yr";

/**
 * Format Admin Users “Comp / period” cell copy.
 */
export function formatPeriodEndUtc(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatCompPeriodLabel(
  input: CompPeriodInput,
  yearlyPriceLabel: string = DEFAULT_YEARLY_PRICE_LABEL,
): string {
  const { stripeCompKind, stripeCurrentPeriodEnd, stripeCancelAtPeriodEnd } =
    input;
  if (!stripeCompKind) return "—";

  const date = formatPeriodEndUtc(stripeCurrentPeriodEnd);

  if (stripeCompKind === "lifetime") {
    if (!date) return "Lifetime · never ends";
    return `Lifetime · renews free ${date}`;
  }

  if (!date) return "One year";

  if (stripeCancelAtPeriodEnd) {
    return `One year · ends ${date}`;
  }
  return `One year · then ${yearlyPriceLabel} from ${date}`;
}
