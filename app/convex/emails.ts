import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { verificationMessage } from "./lib/senderProof";

const FROM_ADDRESS = "shortmail@mail.nonlinearlabs.ai";

/**
 * Send the shortmail via the Resend REST API (parity with utils.py send_email:
 * same from/reply_to/subject/html+text payload).
 *
 * Idempotency-Key makes scheduler retries safe. Failures throw with the
 * Resend error body so they land in `npx convex logs` (a 403 from the
 * not-yet-verified mail.nonlinearlabs.ai domain still proves the wiring).
 * On 2xx the send_success event is recorded (analytics count real emails).
 */
export const sendShortmailEmail = internalAction({
  args: {
    ownerId: v.id("users"),
    replyTo: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set on the Convex deployment");
    }

    // Recipient = the owner's email (finding 16): structural invariant, the
    // caller cannot pass a different address.
    const owner = await ctx.runQuery(internal.users.getUserById, {
      userId: args.ownerId,
    });
    if (!owner) throw new Error(`Owner ${args.ownerId} not found`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: owner.email,
        reply_to: args.replyTo,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const body = await res.text();

    if (!res.ok) {
      throw new Error(
        `Resend send failed (HTTP ${res.status}) for ${owner.email}: ${body}`,
      );
    }

    console.log(
      `[emails] send ok idempotencyKey=${args.idempotencyKey} status=${res.status}`,
    );
    await ctx.runMutation(internal.public.recordEvent, {
      ownerId: args.ownerId,
      type: "send_success",
      subject: args.subject,
    });
  },
});

/**
 * Send a confirmation code to the visitor. The letter is not included.
 * Called directly from the HTTP action so the raw token is not stored as a
 * scheduled-function argument. The token is not logged.
 *
 * :param to: Normalized visitor address.
 * :param token: One-time code. Not written to the database.
 * :param origin: Public site origin used to build the fragment link.
 */
export async function deliverVerificationEmail(
  to: string,
  token: string,
  origin: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set on the Convex deployment");
  }
  const message = verificationMessage(origin, token);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend verification failed (HTTP ${res.status})`);
  }
  console.log(`[emails] verification sent status=${res.status}`);
}
