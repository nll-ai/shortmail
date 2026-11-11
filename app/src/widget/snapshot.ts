import type { WidgetSnapshot } from "./liveUpdates";

type ThemedConfig = {
  displayName: string;
  headings: string[];
  faqs: { question: string; answer: string }[];
  theme: { preset: string; customCss: string | null } | null;
};

/**
 * Copy a theme so a later edit cannot change the object it came from.
 *
 * :param theme: Theme to copy. Null stays null.
 * :returns: A new theme object, or null.
 */
function copyTheme(
  theme: { preset: string; customCss: string | null } | null,
): { preset: string; customCss: string | null } | null {
  if (!theme) return null;
  return { preset: theme.preset, customCss: theme.customCss };
}

/**
 * Lay a server snapshot over a config the widget already fetched.
 *
 * Fields the snapshot does not carry (vanity, paid, embed origins) stay.
 * Theme stays when the snapshot has not resolved one yet. The fetched
 * object is not modified.
 *
 * :param config: Config parsed from the embed endpoint.
 * :param snapshot: Newer page, or null when none has arrived.
 * :returns: The config the form should show.
 */
export function overlayConfig<T extends ThemedConfig>(
  config: T,
  snapshot: WidgetSnapshot | null,
): T {
  if (!snapshot) return config;
  const theme =
    snapshot.theme === undefined ? copyTheme(config.theme) : copyTheme(snapshot.theme);
  return {
    ...config,
    displayName: snapshot.displayName,
    headings: snapshot.headings.slice(),
    faqs: snapshot.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
    theme,
  };
}
