import { describe, expect, it } from "vitest";
import {
  beforeSendAnalytics,
  isSensitivePath,
  isTokenBearingUrl,
} from "./beforeSend";

const pageview = (url: string) => ({ type: "pageview" as const, url });

describe("isSensitivePath", () => {
  it("drops auth callbacks, auth pages, and API routes", () => {
    expect(isSensitivePath("/callback")).toBe(true);
    expect(isSensitivePath("/callback/")).toBe(true);
    expect(isSensitivePath("/auth/error")).toBe(true);
    expect(isSensitivePath("/api/billing/checkout")).toBe(true);
    expect(isSensitivePath("/api")).toBe(true);
  });

  it("keeps public send, landing, and dashboard paths", () => {
    expect(isSensitivePath("/")).toBe(false);
    expect(isSensitivePath("/send/demo")).toBe(false);
    expect(isSensitivePath("/dashboard")).toBe(false);
    expect(isSensitivePath("/dashboard/embed")).toBe(false);
    expect(isSensitivePath("/embed-docs")).toBe(false);
    expect(isSensitivePath("/analytics")).toBe(false);
    expect(isSensitivePath("/verify")).toBe(false);
  });
});

describe("isTokenBearingUrl", () => {
  it("detects OAuth and token query keys", () => {
    expect(
      isTokenBearingUrl(
        new URL("https://shortmail.example/callback?code=abc&state=xyz"),
      ),
    ).toBe(true);
    expect(
      isTokenBearingUrl(
        new URL("https://shortmail.example/dashboard?access_token=secret"),
      ),
    ).toBe(true);
  });

  it("detects the verify-page fragment", () => {
    expect(
      isTokenBearingUrl(new URL("https://shortmail.example/verify#t=secret-code")),
    ).toBe(true);
  });

  it("allows ordinary query strings", () => {
    expect(
      isTokenBearingUrl(new URL("https://shortmail.example/send/demo?utm_source=x")),
    ).toBe(false);
  });
});

describe("beforeSendAnalytics", () => {
  it("records landing, send, embed docs, and dashboard by path only", () => {
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/?utm_source=home"),
      ),
    ).toEqual(pageview("https://shortmail.example/"));
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/send/demo?ref=blog"),
      ),
    ).toEqual(pageview("https://shortmail.example/send/demo"));
    expect(
      beforeSendAnalytics(pageview("https://shortmail.example/embed-docs")),
    ).toEqual(pageview("https://shortmail.example/embed-docs"));
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/dashboard/theming?tab=css"),
      ),
    ).toEqual(pageview("https://shortmail.example/dashboard/theming"));
  });

  it("does not send auth callbacks, API routes, or token-bearing URLs", () => {
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/callback?code=abc"),
      ),
    ).toBeNull();
    expect(
      beforeSendAnalytics(pageview("https://shortmail.example/auth/error")),
    ).toBeNull();
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/api/webhooks/stripe"),
      ),
    ).toBeNull();
    expect(
      beforeSendAnalytics(
        pageview("https://shortmail.example/verify#t=not-for-analytics"),
      ),
    ).toBeNull();
  });

  it("drops malformed URLs", () => {
    expect(beforeSendAnalytics(pageview("not a url"))).toBeNull();
  });
});
