import { describe, expect, it } from "vitest";
import { widgetConvexSite } from "./build-widget.mjs";

describe("widgetConvexSite", () => {
  it("bakes the deployment URL it is given, swapping cloud for site", () => {
    expect(widgetConvexSite("https://happy-otter-123.convex.cloud")).toBe(
      "https://happy-otter-123.convex.site",
    );
    expect(widgetConvexSite("https://hallowed-leopard-387.convex.cloud")).toBe(
      "https://hallowed-leopard-387.convex.site",
    );
  });

  it("is empty when the deploy command did not inject a URL", () => {
    expect(widgetConvexSite("")).toBe("");
    expect(widgetConvexSite("   ")).toBe("");
  });
});
