import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The preview is an empty custom element until widget.js defines it.
 * A styling edit once deleted that script and left the bordered box blank.
 */
describe("dashboard live preview", () => {
  const source = readFileSync(new URL("./DashboardData.tsx", import.meta.url), "utf8");

  it("loads widget.js before rendering the preview element", () => {
    expect(source).toContain('from "next/script"');
    const scriptAt = source.indexOf('src="/widget.js"');
    const strategyAt = source.indexOf('strategy="afterInteractive"');
    const widgetAt = source.indexOf("<shortmail-widget vanity={me.vanityName} />");

    expect(scriptAt).toBeGreaterThan(-1);
    expect(strategyAt).toBeGreaterThan(-1);
    expect(widgetAt).toBeGreaterThan(scriptAt);
    expect(source).toContain("Live preview — what your visitors see");
  });
});
