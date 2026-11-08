import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The preview is an empty custom element until widget.js defines it.
 * A styling edit once deleted that script and left the bordered box blank.
 */
describe("dashboard live preview", () => {
  const source = readFileSync(new URL("./DashboardData.tsx", import.meta.url), "utf8");

  it("loads widget.js before rendering the preview element", () => {
    expect(source).toContain('from "next/script"');
    const scriptAt = source.indexOf('src="/widget.js"');
    const strategyAt = source.indexOf('strategy="afterInteractive"');
    const widgetAt = source.indexOf("<shortmail-widget vanity={me.vanityName} />");

    expect(scriptAt).toBeGreaterThan(-1);
    expect(strategyAt).toBeGreaterThan(-1);
    expect(widgetAt).toBeGreaterThan(scriptAt);
    expect(source).toContain("Live preview — what your visitors see");
  });

  it("renames a FAQ in the preview from the question that is already shown", () => {
    const saveAt = source.indexOf("await editFaq(");
    const nextCatch = source.indexOf("} catch", saveAt);
    const block = source.slice(saveAt, nextCatch);

    expect(saveAt).toBeGreaterThan(-1);
    expect(block).toContain('kind: "faq-edited"');
    expect(block).toContain("previousQuestion: f.question");
    expect(block).toContain("question: editQuestion");
    expect(block).toContain("answer: editAnswer");
  });

  it("removes a FAQ from the preview by the question visitors see", () => {
    const removeAt = source.indexOf("await removeFaq({ id: f.id })");
    const nextCatch = source.indexOf("} catch", removeAt);
    const block = source.slice(removeAt, nextCatch);

    expect(removeAt).toBeGreaterThan(-1);
    expect(block).toContain('kind: "faq-removed"');
    expect(block).toContain("question: f.question");
    expect(block).not.toContain("faq-edited");
    expect(block).not.toContain("editQuestion");
  });
});
