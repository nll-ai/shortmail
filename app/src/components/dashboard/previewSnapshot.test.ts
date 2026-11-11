import { describe, expect, it } from "vitest";
import { previewSnapshot, previewSnapshotKey } from "./previewSnapshot";

/**
 * The dashboard preview has to follow the signed-in owner's Convex rows.
 * These tests pin the slice that an MCP write, another tab, or another
 * device produces. They do not open a browser.
 */

const chat = {
  question: "Can I find time with you to chat?",
  answer: "Yes, please use Calendly.",
};

describe("previewSnapshot", () => {
  it("uses the email when the owner has no display name and leaves theme alone while it is loading", () => {
    const snapshot = previewSnapshot({
      displayName: undefined,
      email: "owner@example.com",
      headings: [{ heading: "Data request" }],
      faqs: [chat],
      theme: undefined,
    });

    expect(snapshot.displayName).toBe("owner@example.com");
    expect(snapshot.headings).toEqual(["Data request"]);
    expect(snapshot.faqs).toEqual([chat]);
    expect(snapshot.theme).toBeUndefined();
    expect("theme" in snapshot).toBe(false);
  });

  it("keeps a saved display name and clears theme on a free account", () => {
    const snapshot = previewSnapshot({
      displayName: "Eric Ma",
      email: "owner@example.com",
      headings: [],
      faqs: [],
      theme: { tier: "free" },
    });

    expect(snapshot.displayName).toBe("Eric Ma");
    expect(snapshot.theme).toBeNull();
  });

  it("copies a premium preset and its custom CSS", () => {
    const snapshot = previewSnapshot({
      displayName: "Eric Ma",
      email: "owner@example.com",
      headings: [{ heading: "Data request" }],
      faqs: [chat],
      theme: {
        tier: "premium",
        preset: "midnight",
        customCss: "button { letter-spacing: 0.2em; }",
      },
    });

    expect(snapshot.theme).toEqual({
      preset: "midnight",
      customCss: "button { letter-spacing: 0.2em; }",
    });
  });

  it("changes the key when an FAQ arrives from outside this tab and stays stable for the same page", () => {
    const input = {
      displayName: "Eric Ma",
      email: "owner@example.com",
      headings: [{ heading: "Data request" }],
      faqs: [chat],
      theme: { tier: "premium" as const, preset: "default", customCss: null },
    };
    const before = previewSnapshot(input);
    const after = previewSnapshot({
      ...input,
      faqs: [chat, { question: "Can my employer sponsor the retreat?", answer: "Yes." }],
    });
    const again = previewSnapshot({
      ...input,
      faqs: [chat, { question: "Can my employer sponsor the retreat?", answer: "Yes." }],
    });

    expect(previewSnapshotKey(after)).not.toBe(previewSnapshotKey(before));
    expect(previewSnapshotKey(again)).toBe(previewSnapshotKey(after));
    expect(before.faqs).toEqual([chat]);
  });
});
