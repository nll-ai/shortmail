import { describe, expect, it } from "vitest";
import { overlayConfig } from "./snapshot";

/**
 * The widget fetches embed config once. A snapshot that arrives later — or
 * that arrives while that fetch is still in flight — has to win, without
 * mutating the object the fetch parsed.
 */

const fetched = {
  vanityName: "fixture",
  displayName: "Fixture Owner",
  headings: ["Data request"],
  faqs: [{ question: "Can I find time with you to chat?", answer: "Yes" }],
  isPaid: false,
  embedAllowedOrigins: [] as string[],
  theme: { preset: "paper", customCss: null },
};

describe("overlayConfig", () => {
  it("returns the fetched config when nothing newer has arrived", () => {
    expect(overlayConfig(fetched, null)).toBe(fetched);
  });

  it("replaces the visitor-facing fields with a server snapshot and leaves the fetch result intact", () => {
    const overlaid = overlayConfig(fetched, {
      displayName: "Eric Ma",
      headings: ["Data request", "Learn Anything retreat"],
      faqs: [
        { question: "Can I find time with you to chat?", answer: "Yes" },
        { question: "Can my employer sponsor the retreat?", answer: "Yes." },
      ],
      theme: { preset: "midnight", customCss: null },
    });

    expect(overlaid.displayName).toBe("Eric Ma");
    expect(overlaid.headings).toEqual(["Data request", "Learn Anything retreat"]);
    expect(overlaid.faqs).toHaveLength(2);
    expect(overlaid.theme).toEqual({ preset: "midnight", customCss: null });
    expect(overlaid.vanityName).toBe("fixture");
    expect(fetched.faqs).toHaveLength(1);
    expect(fetched.displayName).toBe("Fixture Owner");
  });

  it("keeps the fetched theme when the snapshot does not include one yet", () => {
    const overlaid = overlayConfig(fetched, {
      displayName: "Eric Ma",
      headings: ["Data request"],
      faqs: fetched.faqs,
    });

    expect(overlaid.theme).toEqual({ preset: "paper", customCss: null });
    expect(overlaid.theme).not.toBe(fetched.theme);
  });

  it("clears a fetched theme when the server snapshot says there is none", () => {
    const overlaid = overlayConfig(fetched, {
      displayName: "Eric Ma",
      headings: [],
      faqs: [],
      theme: null,
    });

    expect(overlaid.theme).toBeNull();
  });
});
