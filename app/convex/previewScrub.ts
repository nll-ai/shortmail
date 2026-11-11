import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  assertPreviewScrubAllowed,
  preservedEmails,
  scrubbedUserEmail,
} from "./lib/previewScrub";

/**
 * Replace non-operator account emails after a production snapshot import.
 *
 * Runs only when `SHORTMAIL_PREVIEW=1`. Preserved addresses are
 * `SUPER_ADMIN_EMAIL` and `SHORTMAIL_EMAIL_ALLOWLIST`, so those people can
 * still sign in and, if a preview Resend key is configured, receive mail.
 * Display names of rewritten rows become the vanity name. Headings, FAQs,
 * and analytics subjects are not rewritten.
 */
export const scrubPii = internalMutation({
  args: {},
  returns: v.object({
    rewritten: v.number(),
    preserved: v.number(),
  }),
  handler: async (ctx) => {
    assertPreviewScrubAllowed(process.env);
    const preserve = preservedEmails(
      process.env.SHORTMAIL_EMAIL_ALLOWLIST,
      process.env.SUPER_ADMIN_EMAIL,
    );
    let rewritten = 0;
    let preserved = 0;
    for (const user of await ctx.db.query("users").collect()) {
      if (preserve.has(user.email.trim().toLowerCase())) {
        preserved += 1;
        continue;
      }
      await ctx.db.patch(user._id, {
        email: scrubbedUserEmail(user._id),
        displayName: user.vanityName,
      });
      rewritten += 1;
    }
    console.log(
      `[previewScrub] rewritten=${rewritten} preserved=${preserved}`,
    );
    return { rewritten, preserved };
  },
});
