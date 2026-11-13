import { describe, expect, it } from "vitest";
import {
  assertPaidInvariant,
  buildBillingUserPatch,
  PaidStatusInvariantError,
} from "./paidPatch";

describe("paidPatch invariant", () => {
  it("allows isPaid true when stripe ids are present on the patch", () => {
    expect(() =>
      assertPaidInvariant(
        { isPaid: true, stripeCustomerId: "cus_x", stripeSubscriptionId: "sub_x" },
        {},
      ),
    ).not.toThrow();
  });

  it("allows isPaid true when ids exist on the user row", () => {
    expect(() =>
      assertPaidInvariant(
        { isPaid: true },
        { stripeCustomerId: "cus_x", stripeSubscriptionId: "sub_x" },
      ),
    ).not.toThrow();
  });

  it("rejects isPaid true without stripe ids", () => {
    expect(() => assertPaidInvariant({ isPaid: true }, {})).toThrow(
      PaidStatusInvariantError,
    );
  });

  it("allows clearing paid status without stripe ids", () => {
    expect(() => assertPaidInvariant({ isPaid: false }, {})).not.toThrow();
  });

  it("buildBillingUserPatch returns the patch when valid", () => {
    const patch = buildBillingUserPatch(
      { isPaid: true, stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_a" },
      {},
    );
    expect(patch.isPaid).toBe(true);
  });
});
