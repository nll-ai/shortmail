/**
 * Synthetic addresses for the optional preview PII scrub.
 *
 * The default preview hydrate copies production documents unchanged.
 * `SHORTMAIL_PREVIEW_SCRUB=1` rewrites account emails after that copy.
 * Headings, FAQs, and event subjects are left as stored: they are the
 * product content a preview is meant to show, and they can still contain
 * personal text.
 */

const SYNTHETIC_DOMAIN = "shortmail-preview.invalid";

/**
 * Refuse to scrub unless this process is a preview deployment.
 *
 * :param env: Deployment environment.
 */
export function assertPreviewScrubAllowed(env: {
  SHORTMAIL_PREVIEW?: string;
  [name: string]: string | undefined;
}): void {
  if (env.SHORTMAIL_PREVIEW !== "1") {
    throw new Error("preview scrub refused: SHORTMAIL_PREVIEW is not set");
  }
}

/**
 * Build a unique non-routable address for a scrubbed account.
 *
 * `.invalid` is a reserved TLD, so the address cannot be a real mailbox
 * even if a later bug calls Resend with it.
 *
 * :param userId: Convex document id. Unique per user row.
 * :returns: Address under `shortmail-preview.invalid`.
 */
export function scrubbedUserEmail(userId: string): string {
  const local = userId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!local) {
    throw new Error("preview scrub refused: user id has no safe characters");
  }
  return `preview+${local}@${SYNTHETIC_DOMAIN}`;
}

/**
 * Addresses that keep their real email so the operator can sign in.
 *
 * :param allowlist: `SHORTMAIL_EMAIL_ALLOWLIST`.
 * :param superAdmin: `SUPER_ADMIN_EMAIL`.
 * :returns: Lowercased addresses to preserve.
 */
export function preservedEmails(
  allowlist: string | undefined,
  superAdmin: string | undefined,
): Set<string> {
  const preserved = new Set<string>();
  for (const raw of [allowlist, superAdmin]) {
    for (const part of (raw ?? "").split(",")) {
      const email = part.trim().toLowerCase();
      if (email) preserved.add(email);
    }
  }
  return preserved;
}
