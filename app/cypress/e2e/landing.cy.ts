/// <reference types="cypress" />

/**
 * Marketing homepage checks on the fixture server (`/landing`).
 * Convex founding reads and checkout stay off this route.
 */

const FORBIDDEN = ["/api/send", "/api/embed", "/api/collect", "api.resend.com"];

function emulateLandingScheme(scheme: "light" | "dark") {
  cy.then(() =>
    Cypress.automation("remote:debugger:protocol", {
      command: "Emulation.setEmulatedMedia",
      params: { features: [{ name: "prefers-color-scheme", value: scheme }] },
    }),
  );
}

function visitLanding() {
  for (const part of FORBIDDEN) {
    cy.intercept(`**/*${part}*`, () => {
      throw new Error(`forbidden request: ${part}`);
    });
  }
  cy.visit("/landing");
}

describe("marketing landing", () => {
  it("keeps Create your page in the first viewport on mobile and desktop", () => {
    cy.viewport(390, 844);
    visitLanding();
    cy.contains("a", "Create your page").then(($link) => {
      const rect = $link[0].getBoundingClientRect();
      expect(rect.bottom).to.be.lte(844);
      expect(rect.top).to.be.gte(0);
    });

    cy.viewport(1440, 900);
    visitLanding();
    cy.contains("a", "Create your page").then(($link) => {
      const rect = $link[0].getBoundingClientRect();
      expect(rect.bottom).to.be.lte(900);
    });
  });

  it("renders pain, premium embed allowlist, and the privacy paragraph", () => {
    visitLanding();
    cy.contains("h1", "A link for the letters you are willing to read.");
    cy.contains("allowlist of up to 20 sites");
    cy.contains("This page does not charge a card");
    cy.contains("What is kept");
    cy.contains("Will this stop all my email?");
    cy.contains("A fictional page. Nothing on this card is sent.");
  });

  it("follows light and dark color scheme", () => {
    emulateLandingScheme("light");
    cy.viewport(1280, 900);
    visitLanding();
    cy.get("body").should(($body) => {
      expect(getComputedStyle($body[0]).backgroundColor).to.eq("rgb(255, 255, 255)");
    });

    emulateLandingScheme("dark");
    visitLanding();
    cy.get("body").should(($body) => {
      expect(getComputedStyle($body[0]).backgroundColor).to.eq("rgb(10, 10, 10)");
    });
  });
});
