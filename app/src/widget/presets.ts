/**
 * Theme presets: named sets of CSS custom properties consumed by the send
 * form (hosted page) and the embed widget (P6). Custom properties cross the
 * shadow boundary, so the same tokens theme both (plan §3.5–3.6).
 */

export type ThemePreset = {
  id: string;
  label: string;
  vars: Record<string, string>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "Default",
    vars: {
      "--sm-accent": "#111111",
      "--sm-accent-text": "#ffffff",
      "--sm-bg": "#ffffff",
      "--sm-surface": "#f9fafb",
      "--sm-text": "#111111",
      "--sm-muted": "#6b7280",
      "--sm-border": "#d1d5db",
      "--sm-radius": "0.5rem",
      "--sm-font": "var(--font-geist-sans), system-ui, sans-serif",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    vars: {
      "--sm-accent": "#6366f1",
      "--sm-accent-text": "#ffffff",
      "--sm-bg": "#0b1020",
      "--sm-surface": "#151c33",
      "--sm-text": "#e5e7eb",
      "--sm-muted": "#94a3b8",
      "--sm-border": "#27324d",
      "--sm-radius": "0.75rem",
      "--sm-font": "var(--font-geist-sans), system-ui, sans-serif",
    },
  },
  {
    id: "paper",
    label: "Paper",
    vars: {
      "--sm-accent": "#8a5a2b",
      "--sm-accent-text": "#fffdf7",
      "--sm-bg": "#faf6ef",
      "--sm-surface": "#f3ecdf",
      "--sm-text": "#3b2f24",
      "--sm-muted": "#8a7a66",
      "--sm-border": "#d9cbb4",
      "--sm-radius": "0.25rem",
      "--sm-font": "Georgia, 'Times New Roman', serif",
    },
  },
  {
    id: "contrast",
    label: "High contrast",
    vars: {
      "--sm-accent": "#ffe500",
      "--sm-accent-text": "#000000",
      "--sm-bg": "#000000",
      "--sm-surface": "#111111",
      "--sm-text": "#ffffff",
      "--sm-muted": "#cccccc",
      "--sm-border": "#ffffff",
      "--sm-radius": "0rem",
      "--sm-font": "var(--font-geist-mono), ui-monospace, monospace",
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
