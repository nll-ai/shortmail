import { isDisposableEmail } from "./disposableDomains";
import { tagSubject } from "./subjectTag";

/**
 * Pure send-submission validation (codebase-design review finding 7).
 * Extracted from the httpAction closure so the legacy-parity rules are
 * unit-testable at a real seam. The httpAction stays the HTTP seam: read
 * fields → this function → dispatch to submitSend.
 */

export const MAX_MESSAGE_LENGTH = 500;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendFields = {
  sender_name?: string;
  sender_email?: string;
  reply_needed?: string;
  subject?: string;
  custom_subject?: string;
  message?: string;
  website?: string; // honeypot — must stay empty
};

export type SendValues = {
  senderName: string;
  senderEmail: string;
  taggedSubject: string;
  message: string;
};

export type ParseSendResult =
  | { ok: true; values: SendValues }
  | { ok: false; errorCode: string };

/** Validate one parsed send submission. Error codes are the HTTP JSON
 * contract — do not rename without updating clients. */
export function parseSendFields(
  fields: Record<string, string>,
): ParseSendResult {
  // Honeypot: bots filling the invisible `website` field get a quiet 400.
  if (fields.website !== undefined && fields.website !== "") {
    return { ok: false, errorCode: "spam_detected" };
  }

  const senderName = (fields.sender_name ?? "").trim();
  if (!senderName) return { ok: false, errorCode: "sender_name_required" };

  const senderEmail = (fields.sender_email ?? "").trim().toLowerCase();
  if (!EMAIL_SHAPE.test(senderEmail)) {
    return { ok: false, errorCode: "invalid_email" };
  }
  if (isDisposableEmail(senderEmail)) {
    return { ok: false, errorCode: "disposable_email" };
  }

  const message = fields.message ?? "";
  if (!message.trim()) return { ok: false, errorCode: "message_required" };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, errorCode: "message_too_long" };
  }

  // Subject: selected heading, or the custom text when "OTHER" is picked.
  let subject = (fields.subject ?? "").trim();
  if (subject === "OTHER") subject = (fields.custom_subject ?? "").trim();
  if (!subject) return { ok: false, errorCode: "subject_required" };

  // Legacy parity: only the literal "yes" counts as reply-needed.
  const replyNeeded = fields.reply_needed === "yes";

  return {
    ok: true,
    values: {
      senderName,
      senderEmail,
      taggedSubject: tagSubject(subject, replyNeeded),
      message,
    },
  };
}
