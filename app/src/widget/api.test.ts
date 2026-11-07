import { afterEach, describe, expect, it } from "vitest";
import { configUrl, convexSiteUrl } from "./api";

const URL_KEYS = [
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
] as const;

describe("convexSiteUrl", () => {
  const previous = Object.fromEntries(
    URL_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of URL_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("uses the explicit site origin for a local deployment", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "http://127.0.0.1:3211/";
    expect(convexSiteUrl()).toBe("http://127.0.0.1:3211");
    expect(configUrl("demo")).toBe(
      "http://127.0.0.1:3211/api/embed/demo/config",
    );
  });

  it("derives the hosted site twin from the cloud url", () => {
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL =
      "https://happy-animal-123.convex.cloud";
    expect(convexSiteUrl()).toBe("https://happy-animal-123.convex.site");
    expect(configUrl("ada lovelace")).toBe(
      "https://happy-animal-123.convex.site/api/embed/ada%20lovelace/config",
    );
  });
});
