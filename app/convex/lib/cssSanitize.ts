import postcss, { type Rule, type AtRule } from "postcss";

/**
 * Sanitize owner-supplied custom CSS (plan §3.6 v2, R2).
 *
 * Parse-and-allowlist with a real CSS parser (postcss). For every
 * declaration: strip comments → decode CSS escape sequences (`\75rl(` is a
 * hidden `url(`) → lowercase → reject if the value carries network-bearing
 * or script-ish constructs. At-rules that can load anything are dropped
 * wholesale; @media/@supports/@keyframes nesting is walked recursively by
 * postcss itself. Unbalanced braces/quotes fail the parse or the rebuild.
 *
 * Runs identically server-side (save-time, Convex) and client-side
 * (theming-page live preview) — pure TS, no Node APIs.
 */

const FORBIDDEN_FUNCTIONS = ["url(", "image-set(", "attr(", "expression("];
const FORBIDDEN_AT_RULES = new Set([
  "import",
  "font-face",
  "charset",
  "namespace",
  "document",
]);
const FORBIDDEN_PROPERTIES = new Set(["behavior", "expression"]);

const MAX_CSS_BYTES = 16 * 1024;

/** Decode CSS escape sequences: `\75rl(` → `url(`. */
function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (match, code: string) => {
    const hex = code.trim();
    if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return match; // invalid code point — keep raw, the check will fail it
      }
    }
    return code; // escaped punctuation/letter: \: → :
  });
}

/** Remove comments then decode escapes, so hidden `url(` forms can't slip. */
function normalizeValue(rawValue: string): string {
  const noComments = rawValue.replace(/\/\*[\s\S]*?\*\//g, "");
  return decodeCssEscapes(noComments).toLowerCase().replace(/\s+/g, "");
}

function valueIsSafe(normalizedLower: string): boolean {
  return !FORBIDDEN_FUNCTIONS.some((fn) => normalizedLower.includes(fn));
}

export type SanitizeResult =
  | { ok: true; css: string }
  | { ok: false; error: string };

/**
 * Sanitize an owner-supplied stylesheet. Returns the cleaned CSS string
 * (comments stripped, network-bearing constructs removed, ≤16KB) or a
 * rejection reason. Re-serializes through postcss so what we return is
 * exactly what we inspected.
 */
export function sanitizeCss(input: string): SanitizeResult {
  if (input.length > MAX_CSS_BYTES) {
    return { ok: false, error: `CSS exceeds ${MAX_CSS_BYTES / 1024}KB limit` };
  }

  let root;
  try {
    root = postcss.parse(input, { from: "owner-css" });
  } catch (err) {
    return {
      ok: false,
      error: `Could not parse CSS (unbalanced braces or quotes?): ${
        err instanceof Error ? err.message.split("\n")[0] : "parse error"
      }`,
    };
  }

  const unsafe = (what: string): SanitizeResult => ({
    ok: false,
    error: `Not allowed in custom CSS: ${what}`,
  });

  // Walk every node; drop forbidden at-rules, scrub unsafe declarations.
  const dropQueue: AtRule[] = [];

  root.walk((node) => {
    if (node.type === "atrule") {
      const at = node as AtRule;
      const name = at.name.toLowerCase().replace(/^@/, "").split(/\s|-/)[0];
      // @media/@supports/@keyframes/... survive; loaders/enclosers die.
      if (FORBIDDEN_AT_RULES.has(at.name.toLowerCase()) || name === "font") {
        dropQueue.push(at);
      }
      return;
    }
    // Declarations are handled by the walkDecls pass below (decl-level
    // removal keeps the safe siblings of an unsafe declaration).
  });

  for (const node of dropQueue) {
    node.remove();
  }

  // Second pass for declarations whose parent rule becomes unsafe or empty.
  root.walkDecls((decl) => {
    const normalized = normalizeValue(decl.value);
    if (!valueIsSafe(normalized)) {
      decl.remove();
    } else if (FORBIDDEN_PROPERTIES.has(decl.prop.toLowerCase())) {
      decl.remove();
    }
  });

  // Drop rules left with no declarations (e.g. their only decl was unsafe).
  root.walkRules((rule) => {
    if (!rule.nodes || rule.nodes.length === 0) {
      rule.remove();
    }
  });

  const css = root
    .toResult()
    .css.replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (css.length > MAX_CSS_BYTES) {
    return { ok: false, error: `CSS exceeds ${MAX_CSS_BYTES / 1024}KB limit` };
  }
  return { ok: true, css };
}
