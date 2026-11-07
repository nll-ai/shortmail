/**
 * Inbox-possession rules for visitors.
 *
 * Convex stores only hashes. The browser keeps the raw secrets. A confirmed
 * address is not, by itself, permission to send.
 */

export const LINK_TTL_MS = 20 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ADDRESS_COOLDOWN_MS = 10 * 60 * 1000;
export const ADDRESS_DAILY_MAX = 5;
export const GLOBAL_DAILY_MAX = 300;
export const POLL_WINDOW_MS = 20 * 60 * 1000;
export const POLL_MAX = 240;
export const CONFIRM_ATTEMPT_MAX = 10;
export const SENDER_DAILY_MAX = 20;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORIGIN_SHAPE =
  /^https:\/\/[a-z0-9.-]+(?::\d+)?$|^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export type ProofRow = {
  challengeId: string;
  emailHash: string;
  challengeSecretHash: string;
  sessionSecretHash: string;
  verifyTokenHash: string;
  createdAt: number;
  linkExpiresAt: number;
  confirmedAt: number | null;
  sessionExpiresAt: number | null;
};

export type ConfirmResult =
  | { ok: true; row: ProofRow }
  | { ok: false; reason: "invalid" | "expired" | "mismatch" };

/**
 * Normalize a visitor address the same way on start and on send.
 *
 * :param email: Address as typed.
 * :returns: Trimmed lowercase address.
 */
export function normalizeSenderEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether the address has the shape required before we even hash it.
 *
 * :param email: Already normalized address.
 */
export function emailLooksValid(email: string): boolean {
  return EMAIL_SHAPE.test(email);
}

/**
 * SHA-256 hex digest. Callers store this, never the raw secret.
 *
 * :param value: Raw token or secret.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 32 random bytes, URL-safe, with no padding.
 */
export function randomUrlToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

/**
 * Confirmation URL. The token stays in the fragment so a prefetch or a
 * Referer header cannot consume or leak it.
 *
 * :param origin: Public site origin, no path.
 * :param token: One-time verification token.
 */
export function verificationLink(origin: string, token: string): string {
  const trimmed = origin.replace(/\/$/, "");
  if (!ORIGIN_SHAPE.test(trimmed)) {
    throw new Error("public origin is not allowed");
  }
  return `${trimmed}/verify#t=${encodeURIComponent(token)}`;
}

/**
 * Whether this start attempt may send a confirmation message.
 */
export function shouldSendVerification(args: {
  emailLooksValid: boolean;
  disposable: boolean;
  addressCooldownOk: boolean;
  addressDailyOk: boolean;
  globalOk: boolean;
  originConfigured: boolean;
}): boolean {
  return (
    args.emailLooksValid &&
    !args.disposable &&
    args.addressCooldownOk &&
    args.addressDailyOk &&
    args.globalOk &&
    args.originConfigured
  );
}

/**
 * Move a pending proof to confirmed, or explain why this attempt cannot.
 *
 * The same challenge secret may confirm twice. A different secret cannot.
 */
export function confirmTransition(
  row: ProofRow | null,
  tokenHash: string,
  challengeSecretHash: string,
  now: number,
): ConfirmResult {
  if (!row || row.verifyTokenHash !== tokenHash) {
    return { ok: false, reason: "invalid" };
  }
  if (row.challengeSecretHash !== challengeSecretHash) {
    return { ok: false, reason: "mismatch" };
  }
  if (row.confirmedAt !== null) {
    if (row.sessionExpiresAt === null || row.sessionExpiresAt <= now) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, row };
  }
  if (now > row.linkExpiresAt) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      ...row,
      confirmedAt: now,
      sessionExpiresAt: now + SESSION_TTL_MS,
    },
  };
}

/**
 * Status for the browser that holds the challenge secret.
 *
 * A wrong secret looks the same as a missing challenge.
 */
export function pollStatus(
  row: ProofRow | null,
  challengeSecretHash: string,
  now: number,
): "pending" | "confirmed" | "expired" {
  if (!row || row.challengeSecretHash !== challengeSecretHash) return "pending";
  if (row.confirmedAt !== null) {
    if (row.sessionExpiresAt === null || row.sessionExpiresAt <= now) return "expired";
    return "confirmed";
  }
  if (now > row.linkExpiresAt) return "expired";
  return "pending";
}

/**
 * Whether this session secret may deliver a letter for this address now.
 */
export function sessionAllowsSend(
  row: ProofRow | null,
  emailHash: string,
  sessionSecretHash: string,
  now: number,
): boolean {
  if (!row) return false;
  if (row.sessionSecretHash !== sessionSecretHash) return false;
  if (row.emailHash !== emailHash) return false;
  if (row.confirmedAt === null) return false;
  if (row.sessionExpiresAt === null || row.sessionExpiresAt <= now) return false;
  return true;
}

/**
 * Plain-text confirmation message. It carries the code and the link, never a letter.
 */
export function verificationMessage(origin: string, token: string): {
  subject: string;
  text: string;
  html: string;
} {
  const link = verificationLink(origin, token);
  const text = [
    "Enter this code on the ShortMail form where you started the letter:",
    "",
    token,
    "",
    "You can also open this page to copy the code:",
    link,
    "",
    "The page only shows the code. It does not send the letter.",
    "The code expires in 20 minutes.",
    "If you did not ask for this, ignore this message.",
  ].join("\n");
  const html = `<p>Enter this code on the ShortMail form where you started the letter:</p><p><strong>${escapeHtml(token)}</strong></p><p>You can also open this page to copy the code:</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p>The page only shows the code. It does not send the letter. The code expires in 20 minutes.</p><p>If you did not ask for this, ignore this message.</p>`;
  return { subject: "Your ShortMail confirmation code", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
