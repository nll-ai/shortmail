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
    expect(block).toContain("previousQuestion: editing.question");
    expect(block).toContain("question: editQuestion");
    expect(block).toContain("answer: editAnswer");
  });

  it("removes a FAQ from the preview by the question visitors see", () => {
    const removeAt = source.indexOf("removeFaq({ id: faq.id })");
    const dispatched = source.indexOf('kind: "faq-removed"', removeAt);
    const block = source.slice(removeAt, dispatched + 80);

    expect(removeAt).toBeGreaterThan(-1);
    expect(block).toContain('kind: "faq-removed"');
    expect(block).toContain("question: faq.question");
    expect(block).not.toContain("faq-edited");
    expect(block).not.toContain("editQuestion");
  });

  it("tells the preview when headings or FAQs are reordered", () => {
    expect(source).toContain('kind: "headings-reordered"');
    expect(source).toContain("headings: next.map((item) => item.heading)");
    expect(source).toContain('kind: "faqs-reordered"');
    expect(source).toContain("question: item.question, answer: item.answer");
  });

  it("pushes the Convex page into the preview when it changes outside this tab", () => {
    expect(source).toContain("previewSnapshot(");
    expect(source).toContain('kind: "snapshot"');
    expect(source).toContain("api.theming.myTheme");
    const pushed = source.indexOf('kind: "snapshot"');
    const localAdd = source.indexOf('kind: "faq-added"');
    expect(pushed).toBeGreaterThan(-1);
    expect(localAdd).toBeGreaterThan(-1);
  });
});
