import { describe, expect, it } from "vitest";
import { foundingEligibility } from "./foundingEligibility";

const config = {
  foundingCap: 100,
  launchAtMs: Date.parse("2026-01-01T00:00:00Z"),
  foundingWindowDays: 90,
};

describe("foundingEligibility", () => {
  it("is eligible inside the window with cap remaining", () => {
    const result = foundingEligibility({
      config,
      nowMs: config.launchAtMs + 1,
      foundingCustomersCount: 50,
    });
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe("eligible");
  });

  it("closes when the cap is reached before the window ends", () => {
    const result = foundingEligibility({
      config,
      nowMs: config.launchAtMs + 1,
      foundingCustomersCount: 100,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("cap_reached");
  });

  it("closes after the launch window even if cap has room", () => {
    const windowEnd = config.launchAtMs + 90 * 24 * 60 * 60 * 1000;
    const result = foundingEligibility({
      config,
      nowMs: windowEnd,
      foundingCustomersCount: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("window_closed");
  });

  it("is ineligible when launch config is missing", () => {
    expect(
      foundingEligibility({ config: null, nowMs: Date.now(), foundingCustomersCount: 0 })
        .reason,
    ).toBe("no_launch_config");
  });
});
