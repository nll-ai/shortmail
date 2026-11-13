import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LETTER_BODY, LetterSpecimen } from "./LetterSpecimen";

const LETTER =
  "Dr. Adeyemi, I assigned your 2023 heat-mortality paper in my methods seminar. Two students want the ward-level counts behind Figure 3. Can you share them, or tell me who can, before Friday?";

describe("LetterSpecimen", () => {
  it("uses the 189-character Adeyemi letter", () => {
    expect(LETTER_BODY).toBe(LETTER);
    expect(LETTER_BODY.length).toBe(189);
  });

  it("renders a static fictional page and does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = renderToStaticMarkup(<LetterSpecimen />);
    fetchSpy.mockRestore();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain(">Example<");
    expect(html).toContain("A fictional page. Nothing on this card is sent.");
    expect(html).toContain("Dr. Nkechi Adeyemi");
    expect(html).toContain("Professor of environmental health");
    expect(html).toContain("Question about a paper");
    expect(html).toContain("Prospective student");
    expect(html).toContain("Speaking invitation");
    expect(html).toContain("Elena Ruiz, elena.ruiz@example.com");
    expect(html).toContain(LETTER);
    expect(html).toContain("189/500");
    expect(html).toContain("Reply requested: Yes");
    expect(html).toContain('data-selected="true"');
    expect(html.match(/data-selected="true"/g)).toHaveLength(1);
    expect(html).toContain(">Data request<");

    expect(html).not.toMatch(/<form[\s>]/);
    expect(html).not.toMatch(/<input[\s>]/);
    expect(html).not.toMatch(/<textarea[\s>]/);
    expect(html).not.toMatch(/<select[\s>]/);
    expect(html).not.toMatch(/<button[\s>]/);
    expect(html).not.toContain("shortmail-widget");
    expect(html).not.toContain("cce87ae9c1d7");
    expect(html).not.toContain("I'd like you to consult for me");
  });
});
