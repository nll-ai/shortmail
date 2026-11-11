/**
 * The live-update protocol between the dashboard's config editors and
 * mounted <shortmail-widget> instances (codebase-design: one interface,
 * granular DOM updates — no full re-render flash).
 *
 * The widget owns all DOM knowledge; callers describe WHAT changed via this
 * discriminated union and dispatch `dispatchWidgetChange`.
 */

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
  | { kind: "vanity"; vanity: string }; // identity change → full reload

export const WIDGET_CHANGE_EVENT = "shortmail-widget:change";

export function dispatchWidgetChange(change: WidgetChange): void {
  window.dispatchEvent(
    new CustomEvent<WidgetChange>(WIDGET_CHANGE_EVENT, { detail: change }),
  );
}
