/**
 * The one owner of form styling (codebase-design review: unify form
 * styling across surfaces). Every form in the product — the landing demo,
 * the dashboard live preview, the hosted send page, and embedded widgets —
 * renders with these class names and this sheet, so a change here shows up
 * everywhere at once.
 *
 * Light-DOM surfaces adopt the sheet onto `document.adoptedStyleSheets`
 * (via `adoptFormSkinDocument()`); shadow-DOM widgets put it first in
 * `adoptedStyleSheets` so owner theme CSS can override it after.
 *
 * Style: the approved landing form — hairline gray borders, white
 * inputs, square corners, flat black button. Theme variables (--sm-*)
 * flow from the owner's theme through inheritance; fallbacks are neutral.
 */

export const FORM_CSS = `
  .sm-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; color: var(--sm-text, #171717); }
  .sm-label { display: block; font-size: 0.875rem; }
  .sm-label-text { display: block; margin-bottom: 0.25rem; font-weight: 500; }
  .sm-fieldset { border: 0; padding: 0; margin: 0; font-size: 0.875rem; }
  .sm-radio-row { display: flex; gap: 1.5rem; }
  .sm-radio-label { display: flex; align-items: center; gap: 0.375rem; }
  .sm-input, .sm-select, .sm-textarea {
    width: 100%;
    border: 1px solid var(--sm-border, #d4d4d4);
    background: var(--sm-surface, #ffffff);
    color: var(--sm-text, #171717);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    border-radius: var(--sm-radius, 0px);
  }
  .sm-input:focus, .sm-select:focus, .sm-textarea:focus {
    outline: none;
    border-color: var(--sm-accent, #171717);
  }
  .sm-button {
    width: 100%;
    background: var(--sm-accent, #171717);
    color: var(--sm-accent-text, #ffffff);
    border: none;
    padding: 0.625rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .sm-button:hover:not(:disabled) { opacity: 0.8; }
  .sm-button:disabled { opacity: 0.4; cursor: not-allowed; }
  .sm-counter { display: block; margin-top: 0.25rem; text-align: right; font-size: 0.75rem; color: var(--sm-muted, #737373); }
  .sm-counter-over { color: #dc2626; font-weight: 700; }
  .sm-error { color: #dc2626; font-size: 0.875rem; }
  .sm-hint { font-size: 0.85rem; color: var(--sm-muted, #525252); }
  .sm-honeypot { position: absolute; left: -9999px; width: 0; height: 0; opacity: 0; }
`;

let formSheet: CSSStyleSheet | null = null;

/** The shared sheet instance. Same object adopted by light-DOM surfaces and
 * shadow roots alike within a bundle — one replaceSync updates everywhere. */
export function getFormSheet(): CSSStyleSheet {
  if (!formSheet) {
    formSheet = new CSSStyleSheet();
    formSheet.replaceSync(FORM_CSS);
  }
  return formSheet;
}

/** Adopt the form skin on the document (light-DOM React surfaces).
 * Client-only; call once from a mount effect. */
export function adoptFormSkinDocument(): void {
  if (typeof document === "undefined") return;
  if (document.adoptedStyleSheets.some((s) => s === getFormSheet())) return;
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, getFormSheet()];
}
