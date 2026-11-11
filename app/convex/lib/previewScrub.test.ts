import { describe, expect, it } from "vitest";
import {
  assertPreviewScrubAllowed,
  preservedEmails,
  scrubbedUserEmail,
} from "./previewScrub";

describe("preview scrub", () => {
  it("refuses to run unless the deployment is marked as a preview", () => {
    expect(() => assertPreviewScrubAllowed({})).toThrow(/SHORTMAIL_PREVIEW/);
    expect(() => assertPreviewScrubAllowed({ SHORTMAIL_PREVIEW: "1" })).not.toThrow();
  });

  it("rewrites ids into unique .invalid addresses", () => {
    const first = scrubbedUserEmail("jd7abc");
    const second = scrubbedUserEmail("jd7def");
    expect(first).toBe("preview+jd7abc@shortmail-preview.invalid");
    expect(first).not.toBe(second);
    expect(first.endsWith(".invalid")).toBe(true);
  });

  it("preserves the operator allowlist and the super admin, case-insensitively", () => {
    expect(preservedEmails("Eric@Example.com, other@example.com", "Admin@Example.com")).toEqual(
      new Set(["eric@example.com", "other@example.com", "admin@example.com"]),
    );
  });
});
