import postcss from "postcss";

/**
 * Scope owner CSS to a wrapper selector so it can be applied on a hosted
 * page without leaking beyond the themed widget (the widget itself uses a
 * shadow root; the hosted page uses this class-scoped approach).
 *
 * Every selector gets the scope prefixed (`body` → `.scope body`, `.x` →
 * `.scope .x`); at-rules are kept and their inner rules scoped recursively.
 */
export function scopeCss(css: string, scope: string): string {
  if (!css.trim()) return "";
  const root = postcss.parse(css, { from: "owner-css-scoped" });
  root.walkRules((rule) => {
    const selectors = rule.selectors
      .split(",")
      .map((sel) => {
        const trimmed = sel.trim();
        if (!trimmed) return trimmed;
        if (/^(html|body|:root)$/i.test(trimmed)) return scope;
        if (trimmed.startsWith(scope)) return trimmed;
        return `${scope} ${trimmed}`;
      })
      .filter(Boolean);
    rule.selectors = selectors;
  });
  return root.toResult().css.trim();
}
