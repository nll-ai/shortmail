/// <reference types="cypress" />

const CALENDLY = "https://calendly.com/ericmjl/45-minute-meeting";
const QUESTION = "Can I find time with you to chat?";
const ADDED = "Do you read every letter?";
const ADDED_ANSWER = "Write here: https://example.com/letters";
const RENAMED = "Can we talk this week?";

function shadow() {
  return cy.get("shortmail-widget").shadow();
}

function contrast(foreground: string, background: string): number {
  const channel = (value: string) => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(value);
    return [1, 2, 3].map((index) => {
      const scaled = Number(match[index]) / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = (value: string) => {
    const [red, green, blue] = channel(value);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const left = luminance(foreground);
  const right = luminance(background);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function expectNoMail() {
  cy.request("/__calls").its("body").then((body: string[]) => {
    const joined = body.join("\n");
    expect(joined).not.to.contain("/api/send/");
    expect(joined).not.to.contain("/api/verify/");
  });
}

describe("FAQ answers in the real widget", () => {
  beforeEach(() => {
    cy.request("POST", "/__reset");
  });

  it("shows the answer and a clickable Calendly link on the hosted page", () => {
    const shot = (width: number, stem: string) => {
      cy.viewport(width, width < 800 ? 844 : 1000);
      cy.visit("/send/fixture");
      shadow().contains(".sm-faq-question", QUESTION).should("be.visible");
      shadow()
        .contains(".sm-faq-answer a", CALENDLY)
        .should("have.attr", "href", CALENDLY)
        .and("have.attr", "target", "_blank")
        .and("have.attr", "rel", "noopener noreferrer")
        .then(($link) => {
          $link[0].addEventListener("click", (event) => event.preventDefault());
        });
      shadow().contains(".sm-faq-answer a", CALENDLY).click();
      cy.location("pathname").should("eq", "/send/fixture");
      cy.screenshot(`fixture-hosted-faq-${stem}`, { capture: "fullPage" });
    };
    shot(1440, "desktop-light");
    shot(390, "mobile-light");
    shadow().find("script, img").should("have.length", 0);
    expectNoMail();
  });

  it("keeps the same answer under the question in the dashboard preview", () => {
    cy.visit("/");
    cy.contains("FIXTURE — real widget.js, mocked config").should("be.visible");
    shadow().contains(".sm-faq-question", QUESTION);
    shadow().contains(".sm-faq-answer", "Yes, please use Calendly:");
    shadow().contains("a", CALENDLY).should("have.attr", "href", CALENDLY);
    shadow().find(".sm-faq-question").click();
    shadow().contains("a", CALENDLY).should("be.visible");
    expectNoMail();
  });

  it("adds, edits, and removes both the question and the answer", () => {
    cy.visit("/");
    cy.get("#question").clear().type(ADDED);
    cy.get("#answer").clear().type(ADDED_ANSWER);
    cy.get("#add-faq").click();
    shadow().contains(".sm-faq-question", ADDED);
    shadow().contains(".sm-faq-answer a", "https://example.com/letters");

    cy.get("#previous").clear().type(QUESTION);
    cy.get("#question").clear().type(RENAMED);
    cy.get("#answer").clear().type(`Book ${CALENDLY}`);
    cy.get("#save-edit").click();
    shadow().contains(".sm-faq-question", QUESTION).should("not.exist");
    shadow().contains(".sm-faq-question", RENAMED);
    shadow().contains(".sm-faq-answer a", CALENDLY).should("have.attr", "href", CALENDLY);
    shadow().contains(".sm-faq-answer a", "https://example.com/letters");

    cy.get("#previous").clear().type(ADDED);
    cy.get("#remove-faq").click();
    shadow().contains(".sm-faq-question", ADDED).should("not.exist");
    shadow().contains(".sm-faq-answer a", "https://example.com/letters").should("not.exist");
    shadow().contains(".sm-faq-question", RENAMED);
    expectNoMail();
  });

  it("rejects unsafe HTML and scriptable links without parsing the question as HTML", () => {
    cy.visit("/send/unsafe");
    shadow().find(".sm-faq-question").should("have.text", "<img src=x onerror=alert(1)>");
    shadow().find(".sm-faq-question").find("img, script").should("have.length", 0);
    shadow().find("script, img").should("have.length", 0);
    shadow().find("a").should("have.length", 1).and("have.attr", "href", CALENDLY);
    shadow().invoke("prop", "innerHTML").then((html) => {
      expect(html).not.to.contain("<script");
      expect(html).not.to.contain("<img");
      expect(html).not.to.contain("javascript:");
      expect(html).not.to.contain("data:text/html");
    });
    expectNoMail();
  });

  it("stays readable in light and dark, on a phone and a desktop", () => {
    const check = (scheme: "light" | "dark", width: number, stem: string) => {
      cy.viewport(width, width < 800 ? 844 : 1000);
      cy.then(() =>
        Cypress.automation("remote:debugger:protocol", {
          command: "Emulation.setEmulatedMedia",
          params: {
            features: [{ name: "prefers-color-scheme", value: scheme }],
          },
        }),
      );
      cy.visit("/");
      cy.get("body").should(($body) => {
        const background = getComputedStyle($body[0]).backgroundColor;
        expect(background, stem).to.eq(scheme === "dark" ? "rgb(10, 10, 10)" : "rgb(255, 255, 255)");
      });
      shadow().contains("a", CALENDLY).should("be.visible");
      cy.get("#frame").then(($frame) => {
        const background = getComputedStyle($frame[0]).backgroundColor;
        shadow().find(".sm-faq-answer").then(($answer) => {
          const answer = getComputedStyle($answer[0]).color;
          expect(contrast(answer, background), `${stem} answer`).to.be.greaterThan(4.5);
        });
        shadow().find(".sm-faq-question").then(($question) => {
          const question = getComputedStyle($question[0]).color;
          expect(contrast(question, background), `${stem} question`).to.be.greaterThan(4.5);
        });
        shadow().find(".sm-faq-answer a").then(($link) => {
          const link = getComputedStyle($link[0]).color;
          expect(contrast(link, background), `${stem} link`).to.be.greaterThan(4.5);
          expect(getComputedStyle($link[0]).textDecorationLine).to.contain("underline");
        });
      });
      shadow().find(".sm-faq").then(($faq) => {
        expect($faq[0].scrollWidth).to.be.lte($faq[0].clientWidth + 1);
      });
      cy.screenshot(`fixture-faq-${stem}`, { capture: "fullPage" });
    };

    check("light", 1440, "desktop-light");
    check("dark", 1440, "desktop-dark");
    check("light", 390, "mobile-light");
    check("dark", 390, "mobile-dark");
    expectNoMail();
  });
});
