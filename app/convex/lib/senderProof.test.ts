import { describe, expect, it } from "vitest";
import {
  ADDRESS_COOLDOWN_MS,
  ADDRESS_DAILY_MAX,
  GLOBAL_DAILY_MAX,
  LINK_TTL_MS,
  SESSION_TTL_MS,
  confirmTransition,
  pollStatus,
  sessionAllowsSend,
  sha256Hex,
  shouldSendVerification,
  verificationLink,
  verificationMessage,
  type ProofRow,
} from "./senderProof";

const NOW = Date.parse("2026-11-07T15:00:00.000Z");

function row(overrides: Partial<ProofRow> = {}): ProofRow {
  return {
    challengeId: "challenge",
    emailHash: "email-hash",
    challengeSecretHash: "challenge-secret-hash",
    sessionSecretHash: "session-secret-hash",
    verifyTokenHash: "token-hash",
    createdAt: NOW,
    linkExpiresAt: NOW + LINK_TTL_MS,
    confirmedAt: null,
    sessionExpiresAt: null,
    ...overrides,
  };
}

describe("sender proof rules", () => {
  it("hashes tokens and never needs to store the raw secret", async () => {
    const hashed = await sha256Hex("raw-secret");
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain("raw-secret");
    expect(await sha256Hex("raw-secret")).toBe(hashed);
  });

  it("puts the verification token only in the URL fragment", () => {
    const link = verificationLink(
      "https://shortmail-gamma.vercel.app/",
      "abcDEF_123",
    );
    expect(link).toBe(
      "https://shortmail-gamma.vercel.app/verify#t=abcDEF_123",
    );
    expect(link.includes("?")).toBe(false);
    const message = verificationMessage(
      "https://shortmail-gamma.vercel.app",
      "abcDEF_123",
    );
    expect(message.text).toContain("abcDEF_123");
    expect(message.text).toContain("#t=");
    expect(message.text).toContain("Paste the code into the form");
    expect(message.text).not.toContain("only shows the code");
    expect(message.html).toContain("Paste the code into the form");
    expect(message.text).not.toContain("ward-level");
    expect(message.html).not.toContain("?");
    expect(() => verificationLink("https://evil.example/phish", "tok")).toThrow();
  });

  it("confirms once for the browser that started, and rejects replay from another secret", () => {
    const first = confirmTransition(
      row(),
      "token-hash",
      "challenge-secret-hash",
      NOW,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.row.confirmedAt).toBe(NOW);
    expect(first.row.sessionExpiresAt).toBe(NOW + SESSION_TTL_MS);

    const again = confirmTransition(
      first.row,
      "token-hash",
      "challenge-secret-hash",
      NOW + 1000,
    );
    expect(again.ok).toBe(true);

    const otherBrowser = confirmTransition(
      first.row,
      "token-hash",
      "other-secret-hash",
      NOW + 1000,
    );
    expect(otherBrowser).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects an expired or unknown code", () => {
    expect(
      confirmTransition(null, "token-hash", "challenge-secret-hash", NOW),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      confirmTransition(
        row(),
        "token-hash",
        "challenge-secret-hash",
        NOW + LINK_TTL_MS + 1,
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("allows send only for the confirmed address and session", () => {
    const confirmed = row({
      confirmedAt: NOW,
      sessionExpiresAt: NOW + SESSION_TTL_MS,
    });
    expect(
      sessionAllowsSend(
        confirmed,
        "email-hash",
        "session-secret-hash",
        NOW + 1000,
      ),
    ).toBe(true);
    expect(
      sessionAllowsSend(
        confirmed,
        "other-email-hash",
        "session-secret-hash",
        NOW + 1000,
      ),
    ).toBe(false);
    expect(
      sessionAllowsSend(confirmed, "email-hash", "session-secret-hash", NOW + SESSION_TTL_MS),
    ).toBe(false);
    expect(sessionAllowsSend(null, "email-hash", "session-secret-hash", NOW)).toBe(
      false,
    );
    expect(sessionAllowsSend(row(), "email-hash", "session-secret-hash", NOW)).toBe(
      false,
    );
  });

  it("does not tell a poller without the challenge secret that a challenge exists", () => {
    expect(pollStatus(row(), "wrong", NOW)).toBe("pending");
    expect(pollStatus(null, "challenge-secret-hash", NOW)).toBe("pending");
    expect(pollStatus(row(), "challenge-secret-hash", NOW)).toBe("pending");
    expect(
      pollStatus(row(), "challenge-secret-hash", NOW + LINK_TTL_MS + 1),
    ).toBe("expired");
  });

  it("sends confirmation mail only inside the quotas", () => {
    const ok = {
      emailLooksValid: true,
      disposable: false,
      addressCooldownOk: true,
      addressDailyOk: true,
      globalOk: true,
      originConfigured: true,
    };
    expect(shouldSendVerification(ok)).toBe(true);
    expect(shouldSendVerification({ ...ok, disposable: true })).toBe(false);
    expect(shouldSendVerification({ ...ok, emailLooksValid: false })).toBe(false);
    expect(shouldSendVerification({ ...ok, addressCooldownOk: false })).toBe(false);
    expect(shouldSendVerification({ ...ok, addressDailyOk: false })).toBe(false);
    expect(shouldSendVerification({ ...ok, globalOk: false })).toBe(false);
    expect(shouldSendVerification({ ...ok, originConfigured: false })).toBe(false);
    expect(ADDRESS_COOLDOWN_MS).toBe(10 * 60 * 1000);
    expect(ADDRESS_DAILY_MAX).toBe(5);
    expect(GLOBAL_DAILY_MAX).toBe(300);
  });
});
