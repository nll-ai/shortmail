import { describe, expect, it } from "vitest";
import {
  decideOutboundMail,
  parseAllowlist,
  readPreviewMailContext,
  type MailContext,
} from "./previewMail";

const production: MailContext = {
  preview: false,
  allowlist: [],
  sink: undefined,
  hasApiKey: true,
};

const preview: MailContext = {
  preview: true,
  allowlist: ["Eric@Example.com"],
  sink: undefined,
  hasApiKey: true,
};

describe("parseAllowlist", () => {
  it("trims, drops blanks, and keeps the first spelling of a repeat", () => {
    expect(parseAllowlist(" Eric@Example.com, ,eric@example.com,a@b.co ")).toEqual([
      "Eric@Example.com",
      "a@b.co",
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe("decideOutboundMail", () => {
  it("sends production mail to the intended recipient", () => {
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "owner@example.com",
        context: production,
      }),
    ).toEqual({ action: "send", to: "owner@example.com", redirected: false });
  });

  it("sends preview mail when the recipient is on the allowlist", () => {
    expect(
      decideOutboundMail({
        channel: "verification",
        intended: "eric@example.com",
        context: preview,
      }),
    ).toEqual({ action: "send", to: "eric@example.com", redirected: false });
  });

  it("blocks preview mail to anyone else, even when a Resend key is present", () => {
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "real-person@example.com",
        context: preview,
      }),
    ).toEqual({ action: "block", reason: "preview_not_allowlisted" });
  });

  it("blocks every preview recipient when the allowlist is empty", () => {
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "eric@example.com",
        context: { ...preview, allowlist: [] },
      }),
    ).toEqual({ action: "block", reason: "preview_no_allowlist" });
  });

  it("redirects preview letters to an allowlisted sink and never verification codes", () => {
    const context: MailContext = { ...preview, sink: "Eric@Example.com" };
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "owner@example.com",
        context,
      }),
    ).toEqual({ action: "send", to: "Eric@Example.com", redirected: true });
    expect(
      decideOutboundMail({
        channel: "verification",
        intended: "visitor@example.com",
        context,
      }),
    ).toEqual({ action: "block", reason: "preview_not_allowlisted" });
  });

  it("refuses a sink that is not on the allowlist", () => {
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "owner@example.com",
        context: { ...preview, sink: "other@example.com" },
      }),
    ).toEqual({ action: "block", reason: "preview_sink_not_allowlisted" });
  });

  it("does not call Resend for an allowlisted preview recipient without a key", () => {
    expect(
      decideOutboundMail({
        channel: "letter",
        intended: "eric@example.com",
        context: { ...preview, hasApiKey: false },
      }),
    ).toEqual({ action: "block", reason: "preview_no_api_key" });
  });
});

describe("readPreviewMailContext", () => {
  it("treats only SHORTMAIL_PREVIEW=1 as preview mode", () => {
    expect(
      readPreviewMailContext({
        SHORTMAIL_PREVIEW: "1",
        SHORTMAIL_EMAIL_ALLOWLIST: "a@b.co",
        SHORTMAIL_PREVIEW_EMAIL_SINK: "  ",
        RESEND_API_KEY: "re_test",
      }),
    ).toEqual({
      preview: true,
      allowlist: ["a@b.co"],
      sink: undefined,
      hasApiKey: true,
    });
    expect(readPreviewMailContext({ SHORTMAIL_PREVIEW: "true" }).preview).toBe(false);
  });
});
