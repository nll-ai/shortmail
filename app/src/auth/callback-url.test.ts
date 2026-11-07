import { describe, expect, it } from "vitest";
import { callbackUrlFor } from "./callback-url";

const FALLBACK = "https://shortmail-gamma.vercel.app/callback";

describe("callback URL", () => {
  it("keeps a preview sign-in on that preview host", () => {
    expect(
      callbackUrlFor(
        "https://shortmail-ptgfsv8kz-eric-mas-projects-a230afd1.vercel.app",
        FALLBACK,
      ),
    ).toBe(
      "https://shortmail-ptgfsv8kz-eric-mas-projects-a230afd1.vercel.app/callback",
    );
  });

  it("keeps production sign-in on production", () => {
    expect(callbackUrlFor("https://shortmail-gamma.vercel.app", FALLBACK)).toBe(FALLBACK);
  });

  it("allows local http and refuses other hosts", () => {
    expect(callbackUrlFor("http://localhost:3000", FALLBACK)).toBe(
      "http://localhost:3000/callback",
    );
    expect(callbackUrlFor("https://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(callbackUrlFor("not a url", FALLBACK)).toBe(FALLBACK);
  });
});
