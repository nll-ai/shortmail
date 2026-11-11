const KNOWN = [
  "NOT_FOUND",
  "FREE_LIMIT_REACHED",
  "PREMIUM_REQUIRED",
  "RATE_LIMITED",
  "vanity_taken",
  "vanity_invalid",
  "heading_required",
  "faq_fields_required",
  "display_name_required",
  "UNKNOWN_PRESET",
  "Unauthenticated",
] as const;

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "That item is not on your page.",
  FREE_LIMIT_REACHED: "A free account can store 5 subject headings and 3 FAQs.",
  PREMIUM_REQUIRED: "That setting is available on a paid account.",
  RATE_LIMITED: "Too many page changes. Wait a minute and try again.",
  vanity_taken: "That vanity name is already taken.",
  vanity_invalid:
    "Vanity names use lowercase letters, numbers, dashes, and underscores, and must start with a letter or number.",
  heading_required: "A subject heading cannot be empty.",
  faq_fields_required: "A FAQ needs both a question and an answer.",
  display_name_required: "A display name cannot be empty.",
  UNKNOWN_PRESET: "Unknown theme preset. Use default, midnight, paper, or contrast.",
  Unauthenticated: "Sign in before changing the page.",
  REJECTED: "That change was rejected.",
};

export class PageActionError extends Error {
  readonly code: string;

  /**
   * :param code: Stable rejection code from a Convex mutation.
   */
  constructor(code: string) {
    super(code);
    this.name = "PageActionError";
    this.code = code;
  }
}

/**
 * Pull a stable code out of a Convex client error.
 *
 * CSS sanitizer failures are returned as their own message because that
 * message describes the owner's stylesheet, not another account.
 *
 * :param error: Rejection from a query or mutation.
 * :returns: A short code, a CSS message, or `REJECTED`.
 */
export function pageErrorCode(error: unknown): string {
  if (error instanceof PageActionError) return error.code;
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.length > 0 && data.length < 500) {
      return data;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  for (const code of KNOWN) {
    if (message.includes(code)) return code;
  }
  if (
    message.startsWith("CSS ") ||
    message.startsWith("Not allowed in custom CSS") ||
    message.startsWith("Could not parse CSS")
  ) {
    return message.slice(0, 300);
  }
  return "REJECTED";
}

/**
 * Sentence an agent can show the owner.
 *
 * :param code: Value from `pageErrorCode`.
 * :returns: Plain text, with no other account's data.
 */
export function pageErrorMessage(code: string): string {
  return MESSAGES[code] ?? code;
}
