/**
 * Short hardcoded blocklist of common disposable email domains.
 *
 * Parity note: the legacy app's `is_disposable_email` read
 * `data/disposable_emails.txt`, a file that never existed in the repo, so the
 * check was a live no-op. This list replaces it with something real (plan §3.4).
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "yopmail.com",
  "yopmail.fr",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "trashmail.com",
  "trashmail.de",
  "fakeinbox.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "mytemp.email",
  "spam4.me",
  "grr.la",
  "inboxbear.com",
  "burnermail.io",
  "tempr.email",
  "discard.email",
  "emailondeck.com",
]);

/** True when the email's domain is on the disposable blocklist. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase();
  return domain !== undefined && DISPOSABLE_DOMAINS.has(domain);
}
