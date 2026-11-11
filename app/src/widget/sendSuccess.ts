/**
 * Lines shown after the widget accepts a letter.
 *
 * `{name}` is the owner's display name. Callers insert it as literal text.
 * The hosted send page, the embed, and the dashboard preview all use the
 * widget, so this list is the only copy of the success line.
 */
export const SEND_SUCCESS_MESSAGES = [
  "Message sent to {name}! Thanks for keeping it short and sweet.",
  "Message sent to {name}! Short notes get read, and yours will.",
  "Message sent to {name}! Thanks for respecting their inbox.",
  "Message sent to {name}! It's on its way, short and to the point.",
  "Message sent to {name}! Brief, clear, and delivered.",
  "Message sent to {name}! Nice work saying a lot in a little.",
  "Message sent to {name}! Your note is on its way.",
  "Message sent to {name}! Short messages are the kindest kind.",
  "Message sent to {name}! Thanks for getting right to the point.",
  "Message sent to {name}! Delivered, and easy to read.",
] as const;

/** Source in `[0, 1)`. `Math.random` is the production source. */
export type SendSuccessRandom = () => number;

const FALLBACK_NAME = "them";

/**
 * Map one random sample onto a message index.
 *
 * Values outside `[0, 1)` still land on a real line.
 *
 * :param random: Injectable source, so tests can cover every line.
 */
function messageIndex(random: SendSuccessRandom): number {
  const count = SEND_SUCCESS_MESSAGES.length;
  const sample = random();
  if (!Number.isFinite(sample)) return 0;
  const index = Math.floor(sample * count);
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

/**
 * Choose one success line and fill in the owner's name.
 *
 * A missing name stays the previous fallback, "them". The name is inserted
 * with split/join, so characters such as `$&` stay literal.
 *
 * :param displayName: Owner display name, or null when config has none.
 * :param random: Source in `[0, 1)`. Defaults to `Math.random`.
 * :returns: The line the visitor should read.
 */
export function sendSuccessMessage(
  displayName: string | null | undefined,
  random: SendSuccessRandom = Math.random,
): string {
  const name = displayName ?? FALLBACK_NAME;
  const template = SEND_SUCCESS_MESSAGES[messageIndex(random)];
  return template.split("{name}").join(name);
}

/**
 * The success panel. The name is a text node, so markup in it stays visible
 * as characters and is not parsed as HTML.
 *
 * :param displayName: Owner display name, or null when config has none.
 * :param random: Source in `[0, 1)`. Defaults to `Math.random`.
 */
export function renderSendSuccess(
  displayName: string | null | undefined,
  random: SendSuccessRandom = Math.random,
): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "success";
  div.textContent = sendSuccessMessage(displayName, random);
  return div;
}
