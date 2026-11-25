import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const analytics = readFileSync(
  new URL("./ShortmailAnalytics.tsx", import.meta.url),
  "utf8",
);
const widget = readFileSync(
  new URL("../widget/shortmail-widget.ts", import.meta.url),
  "utf8",
);
const nextConfig = readFileSync(
  new URL("../../next.config.ts", import.meta.url),
  "utf8",
);

describe("Vercel Web Analytics wiring", () => {
  it("mounts Analytics from @vercel/analytics/next in the root layout", () => {
    expect(layout).toContain("ShortmailAnalytics");
    expect(analytics).toContain('from "@vercel/analytics/next"');
    expect(analytics).toContain("beforeSend={beforeSendAnalytics}");
  });

  it("does not put Vercel insights inside the third-party widget", () => {
    expect(widget).not.toContain("@vercel/analytics");
    expect(widget).not.toContain("/_vercel/insights");
  });

  it("does not add a CSP that would block same-origin insights", () => {
    expect(nextConfig).not.toMatch(/key:\s*["']Content-Security-Policy["']/);
    expect(nextConfig).toContain("/_vercel/insights");
  });
});
