import type { CSSProperties } from "react";
import { scopeCss } from "./scopeCss";
import { sanitizeCss } from "../../convex/lib/cssSanitize";
import { presetVarsAsStyle } from "./presets";

/** The class every owner-CSS rule is scoped under. Spelled once (finding 3). */
export const THEME_SCOPE_CLASS = "shortmail-scope";

export type AppliedTheme = {
  /** Spread onto the themed container (preset tokens as CSS variables). */
  style: CSSProperties;
  /** Sanitized, scope-prefixed CSS — inject via a <style> tag. Empty if none. */
  css: string;
  /** The scope class to put on the themed container. */
  scopeClass: string;
};

/**
 * The one owner of theme application (codebase-design review, finding 3):
 * preset id → CSS variables, owner CSS → sanitized + scope-prefixed. The
 * hosted send page and the theming-studio preview both call this, so the
 * preview is exactly what visitors see.
 *
 * Server-side and client-side safe (pure TS; postcss is browser-compatible).
 */
export function applyTheme(
  theme: { preset: string; customCss: string | null } | null | undefined,
  scopeClass: string = THEME_SCOPE_CLASS,
): AppliedTheme {
  const style = presetVarsAsStyle(theme?.preset ?? null) as CSSProperties;

  let css = "";
  if (theme?.customCss) {
    // Re-sanitize at apply time: cheap, and makes the render path safe even
    // if a row was written before this sanitizer version existed.
    const result = sanitizeCss(theme.customCss);
    if (result.ok && result.css) {
      css = scopeCss(result.css, scopeClass);
    }
  }

  return { style, css, scopeClass };
}
