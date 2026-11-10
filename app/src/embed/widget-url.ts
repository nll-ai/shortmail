/**
 * Script URL owners paste onto other sites.
 *
 * This is the canonical host. Gamma still serves `/widget.js`, so snippets
 * copied before this change keep working. The string does not follow the
 * page host: a preview dashboard must not hand out a preview URL.
 */
export const CANONICAL_WIDGET_SRC =
  "https://shortmail.nonlinearlabs.ai/widget.js";

/**
 * Copy-paste embed for one vanity name.
 *
 * :param vanity: Owner vanity used as the widget attribute.
 * :returns: Script tag plus the custom element.
 */
export function embedSnippet(vanity: string): string {
  return `<script src="${CANONICAL_WIDGET_SRC}" defer></script>
<shortmail-widget vanity="${vanity}"></shortmail-widget>`;
}
