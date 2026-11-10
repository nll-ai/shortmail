import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { embedSnippet } from "../../embed/widget-url";

describe("embed manager snippet", () => {
  const source = readFileSync(new URL("./EmbedManager.tsx", import.meta.url), "utf8");

  it("copies the canonical widget URL and does not follow the current host", () => {
    expect(embedSnippet("ada")).toBe(
      `<script src="https://shortmail.nonlinearlabs.ai/widget.js" defer></script>
<shortmail-widget vanity="ada"></shortmail-widget>`,
    );
    expect(source).toContain("embedSnippet(vanity)");
    expect(source).not.toContain("shortmail-gamma.vercel.app");
    expect(source).not.toContain("window.location.origin");
  });
});
