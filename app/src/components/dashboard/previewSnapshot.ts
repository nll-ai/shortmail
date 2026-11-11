import type { WidgetSnapshot } from "../../widget/liveUpdates";

export type ThemeQuery =
  | undefined
  | null
  | { tier: "free" }
  | { tier: "premium"; preset: string; customCss: string | null };

/**
 * The visitor-facing page, built from the signed-in owner's Convex rows.
 *
 * Display name follows the public config: a missing name falls back to the
 * account email. Theme is omitted until that query resolves, so a loading
 * state does not wipe a theme the widget already fetched. A free account
 * sends null. A premium account sends the stored preset.
 *
 * :param input: Owner fields. Headings and FAQs are already in display order.
 * :returns: The snapshot to hand to a mounted preview.
 */
export function previewSnapshot(input: {
  displayName: string | null | undefined;
  email: string;
  headings: readonly { heading: string }[];
  faqs: readonly { question: string; answer: string }[];
  theme: ThemeQuery;
}): WidgetSnapshot {
  const snapshot: WidgetSnapshot = {
    displayName: input.displayName ?? input.email,
    headings: input.headings.map((item) => item.heading),
    faqs: input.faqs.map((item) => ({ question: item.question, answer: item.answer })),
  };
  if (input.theme != null) {
    snapshot.theme =
      input.theme.tier === "free"
        ? null
        : { preset: input.theme.preset, customCss: input.theme.customCss };
  }
  return snapshot;
}

/**
 * Stable identity for a snapshot, so the preview is pushed only when the
 * page the visitor would see has changed.
 *
 * :param snapshot: Snapshot from `previewSnapshot`.
 * :returns: A string that changes when any visitor-facing field changes.
 */
export function previewSnapshotKey(snapshot: WidgetSnapshot): string {
  return JSON.stringify(snapshot);
}
