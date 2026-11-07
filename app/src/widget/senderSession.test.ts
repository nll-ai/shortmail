import { describe, expect, it } from "vitest";
import {
  VERIFY_COPY,
  createProof,
  describeSendStep,
  loadProof,
  memoryStore,
  saveProof,
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
});
