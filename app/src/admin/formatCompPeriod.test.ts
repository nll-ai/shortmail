import { describe, expect, it } from "vitest";
import { formatCompPeriodLabel } from "./formatCompPeriod";

const PERIOD_END = Date.parse("2027-11-13T00:00:00.000Z");

describe("formatCompPeriodLabel", () => {
  it("formats lifetime with period end as renews free", () => {
    expect(
      formatCompPeriodLabel({
        stripeCompKind: "lifetime",
        stripeCurrentPeriodEnd: PERIOD_END,
      }),
    ).toBe("Lifetime · renews free Nov 13, 2027");
  });

  it("formats lifetime without period end as never ends", () => {
    expect(
      formatCompPeriodLabel({
        stripeCompKind: "lifetime",
        stripeCurrentPeriodEnd: null,
      }),
    ).toBe("Lifetime · never ends");
  });

  it("formats one-year comp that ends at period end", () => {
    expect(
      formatCompPeriodLabel({
        stripeCompKind: "one_year",
        stripeCurrentPeriodEnd: PERIOD_END,
        stripeCancelAtPeriodEnd: true,
      }),
    ).toBe("One year · ends Nov 13, 2027");
  });

  it("formats one-year comp that renews at list price", () => {
    expect(
      formatCompPeriodLabel({
        stripeCompKind: "one_year",
        stripeCurrentPeriodEnd: PERIOD_END,
        stripeCancelAtPeriodEnd: false,
      }),
    ).toBe("One year · then $48/yr from Nov 13, 2027");
  });
});
