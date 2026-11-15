import { describe, expect, it } from "vitest";
import { subscriptionGrantsPremium } from "./subscriptionPaid";

describe("subscriptionGrantsPremium", () => {
  it("grants premium for active and grace states", () => {
    expect(subscriptionGrantsPremium("active")).toBe(true);
    expect(subscriptionGrantsPremium("trialing")).toBe(true);
    expect(subscriptionGrantsPremium("past_due")).toBe(true);
  });

  it("denies premium for canceled or empty states", () => {
    expect(subscriptionGrantsPremium("canceled")).toBe(false);
    expect(subscriptionGrantsPremium("unpaid")).toBe(false);
    expect(subscriptionGrantsPremium(null)).toBe(false);
  });
});
