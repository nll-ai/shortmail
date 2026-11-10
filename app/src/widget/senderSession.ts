/**
 * Per-browser proof kept in the page's own origin.
 *
 * An embedded host can read this storage. A different origin cannot.
 */

import {
  normalizeSenderEmail,
  randomUrlToken,
  sha256Hex,
} from "../../convex/lib/senderProof";

export const STORAGE_KEY = "shortmail.sender.v1";

export const VERIFY_COPY = {
  check:
    "Check your email, enter the code, and press Confirm email. Your letter stays on this page.",
  ready:
    "Email confirmed for this browser. Press Send shortmail when the letter is ready. Nothing is sent until you do.",
  expired: "That code expired. Request another.",
  mismatch:
    "That code does not match this form. Request a new code from this page.",
  invalid: "That code is not valid. Request another.",
  storage:
    "This browser will not keep the confirmation after you leave. You can still finish in this tab.",
  unconfirmed: "Confirm your email before the letter can be sent.",
  unavailable:
    "We could not send a code right now. Wait a few minutes and try again. Your letter stays on this page.",
} as const;

export type StartResult =
  | { status: "issued"; challengeId: string }
  | { status: "unavailable" }
  | null;

/**
 * Keep a pending proof unless this exact attempt was mailed.
 *
 * A cooldown, a lost response, or a late reply for a different attempt
 * must not replace a code the visitor can still enter.
 */
export function applyIssuedProof(
  stored: ProofRecord | null,
  attempt: ProofRecord,
  result: StartResult,
): ProofRecord | null {
  if (result?.status === "issued" && result.challengeId === attempt.challengeId) {
    return attempt;
  }
  return stored;
}

function sameChallenge(left: ProofRecord | null, right: ProofRecord | null): boolean {
  if (left === null || right === null) return left === right;
  return left.challengeId === right.challengeId;
}

/**
 * Install a mailed challenge only if storage is still the snapshot this
 * attempt started from. A refusal never writes, so another tab's newer
 * proof stays put.
 *
 * :param store: Shared origin storage.
 * :param snapshot: Proof loaded before this request.
 * :param attempt: Challenge created for this request. Not yet stored.
 * :param result: Server result, or null when the request failed.
 * :returns: Whether this attempt is now the stored proof, and what is stored.
 */
export function commitStartAttempt(
  store: KeyValueStore,
  snapshot: ProofRecord | null,
  attempt: ProofRecord,
  result: StartResult,
): { stored: ProofRecord | null; committed: boolean } {
  const current = loadProof(store);
  const issued =
    result?.status === "issued" && result.challengeId === attempt.challengeId;
  if (!issued || !sameChallenge(current, snapshot)) {
    return { stored: current, committed: false };
  }
  saveProof(store, attempt);
  return { stored: attempt, committed: true };
}

/**
 * Sheets the shadow root must keep, in cascade order.
 *
 * Owner CSS is appended after every product sheet.
 * It never replaces the form sheet or the verification sheet.
 *
 * :param layers: Product sheets, earliest first.
 * :param owner: Sanitized owner CSS, or null when the theme has none.
 * :returns: The adopted sheet list.
 */
export function adoptedSheets<T>(layers: readonly T[], owner: T | null): T[] {
  return owner ? [...layers, owner] : [...layers];
}

export type ProofRecord = {
  email: string;
  challengeId: string;
  challengeSecret: string;
  sessionSecret: string;
  status: "pending" | "confirmed";
  sessionExpiresAt: number | null;
};

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type SendStep =
  | { kind: "send"; sessionSecret: string }
  | { kind: "start" }
  | {
      kind: "confirm";
      token: string;
      challengeId: string;
      challengeSecret: string;
    }
  | { kind: "blocked"; message: string };

/**
 * In-memory store used when localStorage throws.
 */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/**
 * Prefer localStorage. Fall back to memory for this tab only.
 */
export function openSenderStore(local: KeyValueStore | null): {
  store: KeyValueStore;
  persistent: boolean;
} {
  if (!local) return { store: memoryStore(), persistent: false };
  try {
    local.setItem(STORAGE_KEY, local.getItem(STORAGE_KEY) ?? "");
    return { store: local, persistent: true };
  } catch {
    return { store: memoryStore(), persistent: false };
  }
}

/**
 * Read the saved proof. A broken value is treated as absent.
 */
export function loadProof(store: KeyValueStore): ProofRecord | null {
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProofRecord>;
    if (!parsed.email || !parsed.challengeId || !parsed.challengeSecret || !parsed.sessionSecret) {
      return null;
    }
    if (parsed.status !== "pending" && parsed.status !== "confirmed") return null;
    return {
      email: parsed.email,
      challengeId: parsed.challengeId,
      challengeSecret: parsed.challengeSecret,
      sessionSecret: parsed.sessionSecret,
      status: parsed.status,
      sessionExpiresAt: parsed.sessionExpiresAt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Save the proof for this origin.
 */
export function saveProof(store: KeyValueStore, record: ProofRecord): void {
  store.setItem(STORAGE_KEY, JSON.stringify(record));
}

/**
 * Create a new pending proof for an address.
 *
 * :param email: Address as typed.
 */
export async function createProof(email: string): Promise<{
  record: ProofRecord;
  challengeSecretHash: string;
  sessionSecretHash: string;
}> {
  const record: ProofRecord = {
    email: normalizeSenderEmail(email),
    challengeId: randomUrlToken(),
    challengeSecret: randomUrlToken(),
    sessionSecret: randomUrlToken(),
    status: "pending",
    sessionExpiresAt: null,
  };
  return {
    record,
    challengeSecretHash: await sha256Hex(record.challengeSecret),
    sessionSecretHash: await sha256Hex(record.sessionSecret),
  };
}

export type VerificationChrome = {
  showCode: boolean;
  showConfirm: boolean;
  showSend: boolean;
  showRequestCode: boolean;
  status: string | null;
};

/**
 * Which verification controls to show for a send step.
 *
 * A pending code has to come back after a reload, including the code box
 * and the Confirm button. Confirmation itself does not send the letter.
 *
 * :param step: Decision from describeSendStep.
 * :returns: Visibility flags, and a status line, or null to leave the current line.
 */
export function verificationChrome(step: SendStep): VerificationChrome {
  if (step.kind === "send") {
    return {
      showCode: false,
      showConfirm: false,
      showSend: true,
      showRequestCode: false,
      status: VERIFY_COPY.ready,
    };
  }
  if (
    step.kind === "confirm" ||
    (step.kind === "blocked" && step.message === VERIFY_COPY.check)
  ) {
    return {
      showCode: true,
      showConfirm: true,
      showSend: false,
      showRequestCode: true,
      status: step.kind === "blocked" ? VERIFY_COPY.check : null,
    };
  }
  if (step.kind === "blocked") {
    return {
      showCode: false,
      showConfirm: false,
      showSend: true,
      showRequestCode: true,
      status: step.message,
    };
  }
  return {
    showCode: false,
    showConfirm: false,
    showSend: true,
    showRequestCode: true,
    status: null,
  };
}

/**
 * Why Send cannot post yet, naming every missing letter field.
 *
 * :param fields: Current form values. emailValid is the email input's validity.
 * :returns: One sentence, or null when the letter fields are complete.
 */
export function sendFieldGaps(fields: {
  name: string;
  email: string;
  emailValid: boolean;
  subject: string;
  customSubject: string;
  message: string;
}): string | null {
  const missing: string[] = [];
  if (fields.name.trim().length === 0) missing.push("your name");
  if (fields.email.trim().length === 0 || !fields.emailValid) missing.push("a valid email");
  if (fields.subject === "OTHER") {
    if (fields.customSubject.trim().length === 0) missing.push("your own subject");
  } else if (fields.subject.trim().length === 0) {
    missing.push("a subject");
  }
  if (fields.message.trim().length === 0) missing.push("a message");
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : missing.length === 2
        ? `${missing[0]} and ${missing[1]}`
        : `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;
  return `Add ${list} before the letter can be sent.`;
}

/**
 * Decide what pressing Send or Confirm should do. The letter is not sent
 * as a side effect of confirmation.
 *
 * :param email: Current email field.
 * :param code: Code field. Empty when the visitor has not pasted one.
 * :param stored: Proof saved for this origin.
 * :param now: Current time in milliseconds.
 */
export function describeSendStep(args: {
  email: string;
  code: string;
  stored: ProofRecord | null;
  now: number;
}): SendStep {
  const email = normalizeSenderEmail(args.email);
  const code = args.code.trim();
  const stored = args.stored;
  const same =
    stored !== null && stored.email === email;
  const sessionLive =
    same &&
    stored.status === "confirmed" &&
    stored.sessionExpiresAt !== null &&
    stored.sessionExpiresAt > args.now;

  if (sessionLive) {
    return { kind: "send", sessionSecret: stored.sessionSecret };
  }
  if (same && stored.status === "pending" && !code) {
    return { kind: "blocked", message: VERIFY_COPY.check };
  }
  if (code) {
    if (!same || stored.status === "confirmed") {
      return { kind: "blocked", message: VERIFY_COPY.mismatch };
    }
    return {
      kind: "confirm",
      token: code,
      challengeId: stored.challengeId,
      challengeSecret: stored.challengeSecret,
    };
  }
  return { kind: "start" };
}
