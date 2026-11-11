/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { faqAnswerLinkDecisions, renderFaqAnswer, safeFaqHref } from "./faqAnswer";

const CALENDLY = "https://calendly.com/ericmjl/45-minute-meeting";

function render(answer: string): HTMLDivElement {
  const holder = document.createElement("div");
  holder.append(renderFaqAnswer(answer));
  return holder;
}

describe("safe FAQ answers", () => {
  it("keeps absolute http(s) and mailto targets", () => {
    expect(safeFaqHref(`  ${CALENDLY}  `)).toBe(CALENDLY);
    expect(safeFaqHref("http://example.com/path")).toBe("http://example.com/path");
    expect(safeFaqHref("mailto:owner@example.com")).toBe("mailto:owner@example.com");
  });

  it("reports the same keep-or-drop decision the public page uses", () => {
    expect(
      faqAnswerLinkDecisions(
        `Book here: [Calendly](${CALENDLY}). Not this: [bad](javascript:alert(1)).`,
      ),
    ).toEqual([
      { href: CALENDLY, kept: true },
      { href: "javascript:alert(1)", kept: false },
    ]);
  });

  it("rejects scriptable and relative targets", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,hi",
      "vbscript:msgbox(1)",
      "/relative",
      "//calendly.com/ericmjl/45-minute-meeting",
      "https://user:pass@calendly.com/ericmjl/45-minute-meeting",
    ]) {
      expect(safeFaqHref(href), href).toBeNull();
    }
  });

  it("turns a bare Calendly URL into one safe link and leaves the period outside it", () => {
    const view = render(
      "Yes, please use Calendly: https://calendly.com/ericmjl/45-minute-meeting.",
    );
    const links = [...view.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(CALENDLY);
    expect(links[0]?.getAttribute("target")).toBe("_blank");
    expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[0]?.textContent).toBe(CALENDLY);
    expect(view.textContent).toContain(`Yes, please use Calendly: ${CALENDLY}.`);
  });

  it("renders a markdown link and emphasis without raw HTML", () => {
    const view = render("**Yes** — [book](https://calendly.com/ericmjl/45-minute-meeting)");
    expect(view.querySelector("strong")?.textContent).toBe("Yes");
    expect(view.querySelector("a")?.getAttribute("href")).toBe(CALENDLY);
    expect(view.querySelector("script")).toBeNull();
  });

  it("drops javascript and data links and does not create executable tags", () => {
    const view = render(
      'See <script>alert(1)</script> <img src=x onerror=alert(1)> [click](javascript:alert(1)) [blob](data:text/html,hi)',
    );
    expect(view.querySelector("script")).toBeNull();
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("a")).toBeNull();
    expect(view.innerHTML).not.toContain("<script");
    expect(view.innerHTML).not.toContain("<img");
    expect(view.innerHTML).not.toContain("javascript:");
    expect(view.textContent).toContain("click");
    expect(view.textContent).toContain("<script>");
    expect(view.textContent).toContain("onerror");
  });
});
