import { describe, expect, it } from "vitest";
import {
  VERIFY_COPY,
  adoptedSheets,
  applyIssuedProof,
  commitStartAttempt,
  createProof,
  describeSendStep,
  loadProof,
  memoryStore,
  saveProof,
  sendFieldGaps,
  verificationChrome,
  type ProofRecord,
} from "./senderSession";

const NOW = Date.parse("2026-11-07T15:00:00.000Z");

function confirmed(email: string): ProofRecord {
  return {
    email,
    challengeId: "challenge",
    challengeSecret: "challenge-secret",
    sessionSecret: "session-secret",
    status: "confirmed",
    sessionExpiresAt: NOW + 1000,
  };
}

describe("sender session storage", () => {
  it("keeps a proof on one origin and invisible to another", async () => {
    const originA = memoryStore();
    const originB = memoryStore();
    const created = await createProof("Ada@Example.com");
    saveProof(originA, { ...created.record, status: "confirmed", sessionExpiresAt: NOW + 1000 });

    expect(loadProof(originA)?.email).toBe("ada@example.com");
    expect(loadProof(originB)).toBeNull();
    expect(created.challengeSecretHash).not.toBe(created.record.challengeSecret);
  });

  it("sends again without a new code, and a changed address cannot reuse the proof", () => {
    const stored = confirmed("ada@example.com");
    expect(describeSendStep({ email: "ada@example.com", code: "", stored, now: NOW })).toEqual({
      kind: "send",
      sessionSecret: "session-secret",
    });
    expect(describeSendStep({ email: "other@example.com", code: "", stored, now: NOW })).toEqual({
      kind: "start",
    });
    expect(
      describeSendStep({
        email: "ada@example.com",
        code: "",
        stored,
        now: NOW + 1000,
      }),
    ).toEqual({ kind: "start" });
  });

  it("confirms only against the proof saved for this form", () => {
    const stored: ProofRecord = {
      ...confirmed("ada@example.com"),
      status: "pending",
      sessionExpiresAt: null,
    };
    expect(
      describeSendStep({ email: "ada@example.com", code: "paste-me", stored, now: NOW }),
    ).toMatchObject({ kind: "confirm", token: "paste-me", challengeSecret: "challenge-secret" });
    expect(
      describeSendStep({ email: "other@example.com", code: "paste-me", stored, now: NOW }).kind,
    ).toBe("blocked");
    expect(
      describeSendStep({ email: "ada@example.com", code: "", stored, now: NOW }).kind,
    ).toBe("blocked");
    expect(VERIFY_COPY.ready).toContain("Nothing is sent until you do");
  });

  it("keeps the mailed challenge when a later attempt is not issued", async () => {
    const first = await createProof("ada@example.com");
    const second = await createProof("ada@example.com");
    const mailed = applyIssuedProof(null, first.record, {
      status: "issued",
      challengeId: first.record.challengeId,
    });
    const delayedUnavailable = applyIssuedProof(mailed, second.record, {
      status: "unavailable",
    });
    const lostResponse = applyIssuedProof(delayedUnavailable, second.record, null);
    expect(lostResponse?.challengeId).toBe(first.record.challengeId);

    const reordered = applyIssuedProof(
      applyIssuedProof(null, second.record, { status: "unavailable" }),
      first.record,
      { status: "issued", challengeId: first.record.challengeId },
    );
    expect(reordered?.challengeId).toBe(first.record.challengeId);
    expect(
      describeSendStep({
        email: "ada@example.com",
        code: "the-original-code",
        stored: reordered,
        now: NOW,
      }),
    ).toMatchObject({
      kind: "confirm",
      challengeId: first.record.challengeId,
      token: "the-original-code",
    });
  });

  it("stops showing a confirmed state after the address changes", () => {
    const stored = confirmed("ada@example.com");
    expect(
      describeSendStep({
        email: "other@example.com",
        code: "",
        stored,
        now: NOW,
      }).kind,
    ).toBe("start");
  });

  it("does not let a refused tab overwrite a challenge another tab just saved", async () => {
    const shared = memoryStore();
    const older = (await createProof("ada@example.com")).record;
    const tabA = (await createProof("ada@example.com")).record;
    const tabB = (await createProof("ada@example.com")).record;
    saveProof(shared, older);

    const issuedFirst = commitStartAttempt(shared, older, tabA, {
      status: "issued",
      challengeId: tabA.challengeId,
    });
    const refusedSecond = commitStartAttempt(shared, older, tabB, {
      status: "unavailable",
    });
    expect(issuedFirst.committed).toBe(true);
    expect(refusedSecond.committed).toBe(false);
    expect(loadProof(shared)?.challengeId).toBe(tabA.challengeId);

    const reordered = memoryStore();
    saveProof(reordered, older);
    expect(
      commitStartAttempt(reordered, older, tabB, null).stored?.challengeId,
    ).toBe(older.challengeId);
    expect(
      commitStartAttempt(reordered, older, tabA, {
        status: "issued",
        challengeId: tabA.challengeId,
      }).committed,
    ).toBe(true);
    expect(
      commitStartAttempt(reordered, older, tabB, {
        status: "issued",
        challengeId: tabB.challengeId,
      }).committed,
    ).toBe(false);
    expect(loadProof(reordered)?.challengeId).toBe(tabA.challengeId);
  });

  it("names every missing letter field, including a custom subject", () => {
    const filled = {
      name: "Eric Ma",
      email: "ericmjl@icloud.com",
      emailValid: true,
      subject: "OTHER",
      customSubject: "TEST",
      message: "TEST",
    };
    expect(sendFieldGaps(filled)).toBeNull();
    expect(sendFieldGaps({ ...filled, subject: "", customSubject: "" })).toBe(
      "Add a subject before the letter can be sent.",
    );
    expect(sendFieldGaps({ ...filled, customSubject: "  " })).toBe(
      "Add your own subject before the letter can be sent.",
    );
    expect(
      sendFieldGaps({
        ...filled,
        name: "",
        subject: "",
        customSubject: "",
        message: "",
      }),
    ).toBe("Add your name, a subject, and a message before the letter can be sent.");
  });

  it("shows the code box again when a pending proof is still the one for this email", () => {
    const stored: ProofRecord = {
      ...confirmed("ericmjl@icloud.com"),
      status: "pending",
      sessionExpiresAt: null,
    };
    const step = describeSendStep({
      email: "ericmjl@icloud.com",
      code: "",
      stored,
      now: NOW,
    });
    expect(verificationChrome(step)).toEqual({
      showCode: true,
      showConfirm: true,
      showSend: false,
      showRequestCode: true,
      status: VERIFY_COPY.check,
    });
    expect(
      verificationChrome(
        describeSendStep({ email: "ericmjl@icloud.com", code: "", stored: confirmed("ericmjl@icloud.com"), now: NOW }),
      ).showSend,
    ).toBe(true);
  });

  it("keeps the verification sheet when owner CSS is applied", () => {
    expect(adoptedSheets(["host", "form", "polish", "verify"], "owner")).toEqual([
      "host",
      "form",
      "polish",
      "verify",
      "owner",
    ]);
    expect(adoptedSheets(["host", "form", "polish", "verify"], null)).toEqual([
      "host",
      "form",
      "polish",
      "verify",
    ]);
  });
});
