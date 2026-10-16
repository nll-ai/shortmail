import { describe, it, expect } from "vitest";
import { parseSendFields } from "./sendRequest";

const base = {
  sender_name: "Ada",
  sender_email: "ada@example.com",
  reply_needed: "no",
  subject: "Hello",
  message: "hi",
};

describe("parseSendFields (legacy-parity rules)", () => {
  it("accepts a valid submission and tags subject [NRN] by default", () => {
    const r = parseSendFields(base);
    expect(r).toMatchObject({
      ok: true,
      values: { taggedSubject: "[NRN] Hello", senderEmail: "ada@example.com" },
    });
  });

  it("tags [RN] only for literal yes", () => {
    const yes = parseSendFields({ ...base, reply_needed: "yes" });
    const one = parseSendFields({ ...base, reply_needed: "1" });
    expect(yes.ok && one.ok).toBe(true);
    if (yes.ok && one.ok) {
      expect(yes.values.taggedSubject).toBe("[RN] Hello");
      expect(one.values.taggedSubject).toBe("[NRN] Hello");
    }
  });

  it("uses custom_subject when subject is OTHER", () => {
    const r = parseSendFields({ ...base, subject: "OTHER", custom_subject: "Keynote" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.taggedSubject).toBe("[NRN] Keynote");
  });

  it("rejects OTHER with empty custom subject", () => {
    expect(parseSendFields({ ...base, subject: "OTHER" })).toMatchObject({
      ok: false,
      errorCode: "subject_required",
    });
  });

  it.each([
    ["missing name", { ...base, sender_name: "" }, "sender_name_required"],
    ["bad email", { ...base, sender_email: "nope" }, "invalid_email"],
    ["empty message", { ...base, message: "  " }, "message_required"],
    ["over 500 chars", { ...base, message: "x".repeat(501) }, "message_too_long"],
    ["filled honeypot", { ...base, website: "http://spam" }, "spam_detected"],
  ])("rejects %s", (_label, fields, code) => {
    expect(parseSendFields(fields as Record<string, string>)).toMatchObject({
      ok: false,
      errorCode: code as string,
    });
  });

  it("rejects disposable sender domains", () => {
    const r = parseSendFields({ ...base, sender_email: "a@mailinator.com" });
    expect(r).toMatchObject({ ok: false, errorCode: "disposable_email" });
  });
});
