/// <reference types="cypress" />

/**
 * Fixture evidence for a page change that did not come from the dashboard
 * buttons. The real widget.js is served by the Cypress fixture server.
 * Nothing is signed in, nothing is saved, and no email is sent.
 */

const ORIGINAL = "Can I find time with you to chat?";
const EXTERNAL = [
  ORIGINAL,
  "Can my employer sponsor the Learn Anything retreat?",
  "How much does the Learn Anything retreat cost?",
  "When and where is the Learn Anything retreat?",
  "Can I split the retreat payment?",
  "How do I talk with you about the retreat?",
];

function shadow() {
  return cy.get("shortmail-widget").shadow();
}

export {};

function questions(): Cypress.Chainable<string[]> {
  return shadow()
    .find(".sm-faq-question")
    .then(($nodes) => [...$nodes].map((node) => node.textContent ?? ""));
}

describe("preview follows an external page change", () => {
  beforeEach(() => {
    cy.request("POST", "/__reset");
  });

  it("replaces the mounted preview when a snapshot arrives from outside this tab", () => {
    cy.viewport(1440, 1200);
    cy.visit("/");
    cy.contains("FIXTURE — real widget.js, mocked config").should("be.visible");
    shadow().contains(".sm-heading", "Send a shortmail to Fixture Owner");
    questions().should("deep.equal", [ORIGINAL]);
    shadow().find("select option").should("have.length", 3);
    cy.screenshot("fixture-external-preview-before", { capture: "fullPage" });

    shadow().find("textarea").type("Please keep this draft");
    shadow().find("select").select("Data request");
    cy.get("#external-change").click();

    cy.contains("External change applied — fixture only").should("be.visible");
    cy.get("#faq-list li").should("have.length", EXTERNAL.length);
    shadow().contains(".sm-heading", "Send a shortmail to Eric Ma");
    questions().should("deep.equal", EXTERNAL);
    shadow().contains(".sm-faq-answer", "$4,997");
    shadow().find("select option").should("have.length", 4);
    shadow().find("select").should("have.value", "Data request");
    shadow().find("textarea").should("have.value", "Please keep this draft");
    cy.get("shortmail-widget").should("have.css", "background-color", "rgb(11, 16, 32)");
    shadow().find("button.sm-button").should(($button) => {
      const spacing = getComputedStyle($button[0]).letterSpacing;
      expect(spacing).to.not.equal("normal");
      expect(Number.parseFloat(spacing)).to.be.greaterThan(2);
    });
    cy.screenshot("fixture-external-preview-after", { capture: "fullPage" });

    cy.window().then((win) => {
      win.dispatchEvent(
        new CustomEvent("shortmail-widget:change", {
          detail: { kind: "heading-added", heading: "Learn Anything retreat" },
        }),
      );
      win.dispatchEvent(
        new CustomEvent("shortmail-widget:change", {
          detail: {
            kind: "faq-added",
            question: "Can my employer sponsor the Learn Anything retreat?",
            answer: "Yes. Send me a shortmail and I will send a program overview.",
          },
        }),
      );
    });
    shadow()
      .find("option")
      .then(($options) => {
        const matches = [...$options].filter((option) => option.value === "Learn Anything retreat");
        expect(matches).to.have.length(1);
      });
    questions().should("deep.equal", EXTERNAL);

    cy.get("#question").clear().type("Is a local edit still instant?");
    cy.get("#answer").clear().type("Yes. This did not wait for a reload.");
    cy.get("#add-faq").click();
    questions().should("deep.equal", [...EXTERNAL, "Is a local edit still instant?"]);
    shadow().find("textarea").should("have.value", "Please keep this draft");

    cy.request("/__calls").its("body").then((body: string[]) => {
      const joined = body.join("\n");
      expect(joined).not.to.contain("/api/send/");
      expect(joined).not.to.contain("/api/verify/");
    });
  });
});