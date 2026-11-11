/**
 * Theme presets: named sets of CSS custom properties consumed by the send
 * form (hosted page) and the embed widget. Custom properties cross the
 * shadow boundary, so the same tokens theme both.
 *
 * `default` follows the visitor's `prefers-color-scheme`. Midnight, paper,
 * and high contrast are explicit colors and stay put when the OS changes.
 */

export type ColorScheme = "light" | "dark" | "light dark";

export type ThemePreset = {
  id: string;
  label: string;
  /** Native controls. `light dark` tracks the OS. */
  colorScheme: ColorScheme;
  vars: Record<string, string>;
};

/** Default-theme colors. Resolved from the element's `color-scheme`. */
export const ADAPTIVE = {
  accent: "light-dark(#171717, #ededed)",
  accentText: "light-dark(#ffffff, #171717)",
  bg: "light-dark(#ffffff, #0a0a0a)",
  surface: "light-dark(#ffffff, #171717)",
  text: "light-dark(#171717, #ededed)",
  muted: "light-dark(#525252, #a3a3a3)",
  border: "light-dark(#767676, #8a8a8a)",
  danger: "light-dark(#dc2626, #fca5a5)",
} as const;

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "Default",
    colorScheme: "light dark",
    vars: {
      "--sm-accent": ADAPTIVE.accent,
      "--sm-accent-text": ADAPTIVE.accentText,
      "--sm-bg": ADAPTIVE.bg,
      "--sm-surface": ADAPTIVE.surface,
      "--sm-text": ADAPTIVE.text,
      "--sm-muted": ADAPTIVE.muted,
      "--sm-border": ADAPTIVE.border,
      "--sm-danger": ADAPTIVE.danger,
      "--sm-radius": "0px",
      "--sm-font": "var(--font-geist-sans, system-ui, sans-serif)",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    colorScheme: "dark",
    vars: {
      "--sm-accent": "#6366f1",
      "--sm-accent-text": "#ffffff",
      "--sm-bg": "#0b1020",
      "--sm-surface": "#151c33",
      "--sm-text": "#e5e7eb",
      "--sm-muted": "#94a3b8",
      "--sm-border": "#27324d",
      "--sm-danger": "#fca5a5",
      "--sm-radius": "0.75rem",
      "--sm-font": "var(--font-geist-sans, system-ui, sans-serif)",
    },
  },
  {
    id: "paper",
    label: "Paper",
    colorScheme: "light",
    vars: {
      "--sm-accent": "#8a5a2b",
      "--sm-accent-text": "#fffdf7",
      "--sm-bg": "#faf6ef",
      "--sm-surface": "#f3ecdf",
      "--sm-text": "#3b2f24",
      "--sm-muted": "#8a7a66",
      "--sm-border": "#d9cbb4",
      "--sm-danger": "#b91c1c",
      "--sm-radius": "0.25rem",
      "--sm-font": "Georgia, 'Times New Roman', serif",
    },
  },
  {
    id: "contrast",
    label: "High contrast",
    colorScheme: "dark",
    vars: {
      "--sm-accent": "#ffe500",
      "--sm-accent-text": "#000000",
      "--sm-bg": "#000000",
      "--sm-surface": "#111111",
      "--sm-text": "#ffffff",
      "--sm-muted": "#cccccc",
      "--sm-border": "#ffffff",
      "--sm-danger": "#ffb4b4",
      "--sm-radius": "0rem",
      "--sm-font": "var(--font-geist-mono, ui-monospace, monospace)",
    },
  },
];

export const DEFAULT_PRESET_ID = "default";

export function presetById(id: string | undefined | null): ThemePreset {
  return (
    THEME_PRESETS.find((p) => p.id === id) ??
    THEME_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  );
}

/** Inline style object for React: spread onto any themed container. */
export function presetVarsAsStyle(
  id: string | undefined | null,
): Record<string, string> {
  return presetById(id).vars;
}

/**
 * Select chevron painted in one solid color.
 *
 * Used for explicit presets. The default theme leaves this unset and the
 * stylesheet swaps the chevron with `prefers-color-scheme`.
 *
 * :param stroke: Hex color, including the leading `#`.
 * :returns: A CSS `url("data:image/svg+xml,...")` value.
 */
export function selectChevron(stroke: string): string {
  const color = stroke.replace("#", "%23");
  return `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 6 L8 10.5 L12.5 6' fill='none' stroke='${color}' stroke-width='1.25' stroke-linecap='square' stroke-linejoin='miter'/%3E%3C/svg%3E")`;
}
