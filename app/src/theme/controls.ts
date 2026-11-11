/** Keyboard focus ring. The color is the shared `--focus` token. */
export const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Dashboard text field. Underline and placeholder follow the OS scheme. */
export const fieldClass =
  "w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none";

/** Compact ink button used on the dashboard. Inverts with the scheme. */
export const controlClass =
  " border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-foreground hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** Primary action on settings pages. */
export const primaryClass =
  " bg-accent px-5 py-2 text-sm text-accent-foreground hover:opacity-80 disabled:opacity-40";

/** Code sample. The dark chip stays high-contrast in both schemes. */
export const codeBlockClass =
  "mt-2 overflow-x-auto border border-line bg-code p-4 text-xs text-code-foreground";
