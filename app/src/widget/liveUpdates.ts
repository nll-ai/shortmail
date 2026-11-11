/**
 * The live-update protocol between the dashboard's config editors and
 * mounted <shortmail-widget> instances (codebase-design: one interface,
 * granular DOM updates — no full re-render flash).
 *
 * The widget owns all DOM knowledge; callers describe WHAT changed via this
 * discriminated union and dispatch `dispatchWidgetChange`.
 *
 * Local editors dispatch the granular kinds so a click updates the preview
 * before the round trip. `snapshot` is the whole page from Convex — MCP,
 * another tab, or another device — and replaces those fields in place.
 */

export type WidgetSnapshot = {
  displayName: string;
  headings: string[];
  faqs: { question: string; answer: string }[];
  /**
   * Absent while theme has not loaded. Null is a resolved page with no
   * saved theme. An object is the premium preset visitors see.
   */
  theme?: { preset: string; customCss: string | null } | null;
};

export type WidgetChange =
  | { kind: "display-name"; value: string }
  | { kind: "heading-added"; heading: string }
  | { kind: "heading-removed"; heading: string }
  | { kind: "headings-reordered"; headings: string[] }
  | { kind: "faq-added"; question: string; answer: string }
  | {
      kind: "faq-edited";
      previousQuestion?: string;
      question: string;
      answer: string;
    }
  | { kind: "faq-removed"; question: string }
  | { kind: "faqs-reordered"; faqs: { question: string; answer: string }[] }
  | { kind: "theme"; preset: string; customCss: string | null }
  | ({ kind: "snapshot" } & WidgetSnapshot)
  | { kind: "vanity"; vanity: string }; // identity change → full reload

export const WIDGET_CHANGE_EVENT = "shortmail-widget:change";

export function dispatchWidgetChange(change: WidgetChange): void {
  window.dispatchEvent(
    new CustomEvent<WidgetChange>(WIDGET_CHANGE_EVENT, { detail: change }),
  );
}
