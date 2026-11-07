import { describe, expect, it } from "vitest";
import type { MutationCtx } from "../_generated/server";
import { bump, utcDay } from "./rateLimit";
import {
  ADDRESS_DAILY_MAX,
  GLOBAL_DAILY_MAX,
  LINK_TTL_MS,
  confirmTransition,
  sha256Hex,
} from "./senderProof";
import { reserveVerificationSend } from "../senderProof";
import { applyIssuedProof, createProof } from "../../src/widget/senderSession";

/**
 * Enough of a Convex context for the real `bump` limiter.
 */
function rateCtx(): MutationCtx {
  const rows = new Map<
    string,
    { _id: string; key: string; windowStart: number; count: number }
  >();
  let nextId = 0;
  return {
    db: {
      query(table: string) {
        return {
          withIndex(
            _index: string,
            filter: (q: { eq: (field: string, value: string) => unknown }) => unknown,
          ) {
            let key = "";
            const query = {
              eq(field: string, value: string) {
                if (field === "key") key = value;
                return query;
              },
            };
            filter(query);
            return {
              async unique() {
                if (table !== "rateLimits") return null;
                for (const row of rows.values()) {
                  if (row.key === key) return row;
                }
                return null;
              },
            };
          },
        };
      },
      async insert(
        _table: string,
        doc: { key: string; windowStart: number; count: number },
      ) {
        const _id = `rate-${nextId++}`;
        rows.set(_id, { _id, ...doc });
        return _id;
      },
      async patch(
        id: string,
        patch: { windowStart?: number; count?: number },
      ) {
        const row = rows.get(id);
        if (row) Object.assign(row, patch);
      },
    },
  } as unknown as MutationCtx;
}

async function attempt(email = "ada@example.com") {
  const proof = await createProof(email);
  return {
    proof,
    args: {
      email,
      challengeId: proof.record.challengeId,
      challengeSecretHash: proof.challengeSecretHash,
      sessionSecretHash: proof.sessionSecretHash,
      verifyTokenHash: proof.challengeSecretHash,
      originConfigured: true,
    },
  };
}

describe("real verification limiter", () => {
  it("mails one code for a double start and still accepts that original code", async () => {
    const ctx = rateCtx();
    const first = await attempt();
    const second = await attempt();
    expect(await reserveVerificationSend(ctx, first.args)).toBe(true);
    expect(await reserveVerificationSend(ctx, second.args)).toBe(false);

    const kept = applyIssuedProof(
      applyIssuedProof(null, second.proof.record, { status: "unavailable" }),
      first.proof.record,
      { status: "issued", challengeId: first.proof.record.challengeId },
    );
    expect(kept?.challengeId).toBe(first.proof.record.challengeId);

    const now = Date.now();
    const confirmed = confirmTransition(
      {
        challengeId: first.proof.record.challengeId,
        emailHash: await sha256Hex("ada@example.com"),
        challengeSecretHash: first.proof.challengeSecretHash,
        sessionSecretHash: first.proof.sessionSecretHash,
        verifyTokenHash: await sha256Hex("original-code"),
        createdAt: now,
        linkExpiresAt: now + LINK_TTL_MS,
        confirmedAt: null,
        sessionExpiresAt: null,
      },
      await sha256Hex("original-code"),
      first.proof.challengeSecretHash,
      now,
    );
    expect(confirmed.ok).toBe(true);
  });

  it("does not replace a mailed challenge when resend, quota, or delivery fails", async () => {
    const ctx = rateCtx();
    const first = await attempt();
    expect(await reserveVerificationSend(ctx, first.args)).toBe(true);
    const stored = applyIssuedProof(null, first.proof.record, {
      status: "issued",
      challengeId: first.proof.record.challengeId,
    });
    const resend = await attempt();
    expect(await reserveVerificationSend(ctx, resend.args)).toBe(false);
    expect(
      applyIssuedProof(stored, resend.proof.record, { status: "unavailable" })
        ?.challengeId,
    ).toBe(first.proof.record.challengeId);
    expect(applyIssuedProof(stored, resend.proof.record, null)?.challengeId).toBe(
      first.proof.record.challengeId,
    );

    const daily = rateCtx();
    const emailHash = await sha256Hex("ada@example.com");
    for (let i = 0; i < ADDRESS_DAILY_MAX; i += 1) {
      await bump(daily, `verify:addr:${emailHash}:${utcDay()}`, null, ADDRESS_DAILY_MAX);
    }
    const overDaily = await attempt();
    expect(await reserveVerificationSend(daily, overDaily.args)).toBe(false);

    const global = rateCtx();
    for (let i = 0; i < GLOBAL_DAILY_MAX; i += 1) {
      await bump(global, `verify:global:${utcDay()}`, null, GLOBAL_DAILY_MAX);
    }
    const overGlobal = await attempt("other@example.com");
    expect(await reserveVerificationSend(global, overGlobal.args)).toBe(false);

    const offline = rateCtx();
    const config = await attempt("fresh@example.com");
    expect(
      await reserveVerificationSend(offline, {
        ...config.args,
        originConfigured: false,
      }),
    ).toBe(false);
    expect(await reserveVerificationSend(offline, config.args)).toBe(true);
  });
});
