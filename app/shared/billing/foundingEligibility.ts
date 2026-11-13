import type { BillingConfig } from "./config";

export type FoundingEligibilityInput = {
  config: BillingConfig | null;
  nowMs: number;
  foundingCustomersCount: number;
};

export type FoundingEligibility = {
  eligible: boolean;
  reason:
    | "no_launch_config"
    | "window_closed"
    | "cap_reached"
    | "eligible";
  windowEndsAtMs: number | null;
};

/**
 * Founding price is available until the launch window ends or the cap is hit,
 * whichever comes first.
 */
export function foundingEligibility(
  input: FoundingEligibilityInput,
): FoundingEligibility {
  if (!input.config) {
    return { eligible: false, reason: "no_launch_config", windowEndsAtMs: null };
  }

  const windowMs = input.config.foundingWindowDays * 24 * 60 * 60 * 1000;
  const windowEndsAtMs = input.config.launchAtMs + windowMs;
  const windowOpen = input.nowMs < windowEndsAtMs;
  const capOpen = input.foundingCustomersCount < input.config.foundingCap;

  if (!windowOpen) {
    return { eligible: false, reason: "window_closed", windowEndsAtMs };
  }
  if (!capOpen) {
    return { eligible: false, reason: "cap_reached", windowEndsAtMs };
  }
  return { eligible: true, reason: "eligible", windowEndsAtMs };
}
