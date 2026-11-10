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

  it("keeps a branch-alias preview sign-in on that preview host", () => {
    const origin =
      "https://shortmail-git-cursor-canonica-804ede-eric-mas-projects-a230afd1.vercel.app";
    expect(callbackUrlFor(origin, FALLBACK)).toBe(`${origin}/callback`);
  });

  it("keeps production sign-in on production", () => {
    expect(callbackUrlFor("https://shortmail-gamma.vercel.app", FALLBACK)).toBe(FALLBACK);
  });

  it("keeps canonical-host sign-in on that host", () => {
    expect(
      callbackUrlFor("https://shortmail.nonlinearlabs.ai", FALLBACK),
    ).toBe("https://shortmail.nonlinearlabs.ai/callback");
    expect(
      callbackUrlFor("https://shortmail.nonlinearlabs.ai/dashboard?next=1", FALLBACK),
    ).toBe("https://shortmail.nonlinearlabs.ai/callback");
    expect(
      callbackUrlFor("https://Shortmail.Nonlinearlabs.AI/login", FALLBACK),
    ).toBe("https://shortmail.nonlinearlabs.ai/callback");
  });

  it("allows local http and refuses other hosts", () => {
    expect(callbackUrlFor("http://localhost:3000", FALLBACK)).toBe(
      "http://localhost:3000/callback",
    );
    expect(callbackUrlFor("http://127.0.0.1:3000", FALLBACK)).toBe(
      "http://127.0.0.1:3000/callback",
    );
    expect(callbackUrlFor("https://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(callbackUrlFor("not a url", FALLBACK)).toBe(FALLBACK);
    expect(callbackUrlFor("http://shortmail.nonlinearlabs.ai", FALLBACK)).toBe(FALLBACK);
    expect(callbackUrlFor("http://shortmail-gamma.vercel.app", FALLBACK)).toBe(FALLBACK);
    expect(
      callbackUrlFor("https://shortmail.nonlinearlabs.ai.evil.example", FALLBACK),
    ).toBe(FALLBACK);
    expect(
      callbackUrlFor("https://evil.shortmail.nonlinearlabs.ai", FALLBACK),
    ).toBe(FALLBACK);
    expect(
      callbackUrlFor("https://notshortmail.nonlinearlabs.ai", FALLBACK),
    ).toBe(FALLBACK);
    expect(
      callbackUrlFor("https://shortmail-gamma.vercel.app.evil.example", FALLBACK),
    ).toBe(FALLBACK);
    expect(
      callbackUrlFor(
        "https://shortmail-git-foo-eric-mas-projects-a230afd1.vercel.app.evil.example",
        FALLBACK,
      ),
    ).toBe(FALLBACK);
    expect(
      callbackUrlFor(
        "https://evil.example/?next=https://shortmail.nonlinearlabs.ai",
        FALLBACK,
      ),
    ).toBe(FALLBACK);
  });
});
