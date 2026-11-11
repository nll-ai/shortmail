/**
 * Outbound mail policy for Convex preview deployments.
 *
 * Production deployments send to the real recipient. Preview deployments
 * (`SHORTMAIL_PREVIEW=1`) may deliver only to `SHORTMAIL_EMAIL_ALLOWLIST`.
 * Letters can be redirected to `SHORTMAIL_PREVIEW_EMAIL_SINK` when that
 * address is itself on the allowlist. Verification codes are never
 * redirected: the code would confirm the wrong inbox.
 */

export type MailChannel = "letter" | "verification";

export type MailEnv = {
  SHORTMAIL_PREVIEW?: string;
  SHORTMAIL_EMAIL_ALLOWLIST?: string;
  SHORTMAIL_PREVIEW_EMAIL_SINK?: string;
  RESEND_API_KEY?: string;
  [name: string]: string | undefined;
};

export type MailDecision =
  | { action: "send"; to: string; redirected: boolean }
  | { action: "block"; reason: PreviewBlockReason };

export type PreviewBlockReason =
  | "preview_no_api_key"
  | "preview_no_allowlist"
  | "preview_not_allowlisted"
  | "preview_sink_not_allowlisted";

export type MailContext = {
  preview: boolean;
  allowlist: string[];
  sink: string | undefined;
  hasApiKey: boolean;
};

/**
 * Split a comma-separated allowlist into trimmed addresses.
 *
 * Comparison is case-insensitive. Empty entries are dropped.
 *
 * :param raw: `SHORTMAIL_EMAIL_ALLOWLIST`, or undefined when unset.
 * :returns: Addresses in first-seen order, lowercased only for storage of the key.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const part of raw.split(",")) {
    const address = part.trim();
    const key = address.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    addresses.push(address);
  }
  return addresses;
}

/**
 * Read the preview mail switches from the deployment environment.
 *
 * :param env: Deployment environment. Defaults are the process environment.
 * :returns: Whether this deployment is a preview, and the allowlist it may use.
 */
export function readPreviewMailContext(env: MailEnv = process.env): MailContext {
  const sink = env.SHORTMAIL_PREVIEW_EMAIL_SINK?.trim();
  return {
    preview: env.SHORTMAIL_PREVIEW === "1",
    allowlist: parseAllowlist(env.SHORTMAIL_EMAIL_ALLOWLIST),
    sink: sink ? sink : undefined,
    hasApiKey: Boolean(env.RESEND_API_KEY),
  };
}

/**
 * Decide whether a preview or production deployment may call Resend.
 *
 * Production is unchanged: the caller still requires `RESEND_API_KEY` and
 * sends to the intended recipient. Preview never returns a recipient that
 * is outside the allowlist.
 *
 * :param input: Channel, intended recipient, and the preview context.
 * :returns: A send target, or a block reason with no address attached.
 */
export function decideOutboundMail(input: {
  channel: MailChannel;
  intended: string;
  context: MailContext;
}): MailDecision {
  const intended = input.intended.trim();
  if (!input.context.preview) {
    return { action: "send", to: intended, redirected: false };
  }

  const allow = new Map(
    input.context.allowlist.map((address) => [address.toLowerCase(), address]),
  );
  const intendedKey = intended.toLowerCase();
  if (allow.has(intendedKey)) {
    if (!input.context.hasApiKey) {
      return { action: "block", reason: "preview_no_api_key" };
    }
    return { action: "send", to: intended, redirected: false };
  }

  const sink = input.context.sink?.trim() ?? "";
  const sinkKey = sink.toLowerCase();
  if (sinkKey && !allow.has(sinkKey)) {
    return { action: "block", reason: "preview_sink_not_allowlisted" };
  }
  if (input.channel === "letter" && sinkKey && allow.has(sinkKey)) {
    if (!input.context.hasApiKey) {
      return { action: "block", reason: "preview_no_api_key" };
    }
    return {
      action: "send",
      to: allow.get(sinkKey) ?? sink,
      redirected: true,
    };
  }
  if (allow.size === 0) {
    return { action: "block", reason: "preview_no_allowlist" };
  }
  return { action: "block", reason: "preview_not_allowlisted" };
}
