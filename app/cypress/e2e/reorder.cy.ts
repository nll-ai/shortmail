/// <reference types="cypress" />

const CONSULT = "I'd like you to consult for me";
const TALK = "I'd like to invite you to give a talk";
const SCIPY = "SciPy 2026 Fundraiser";
const CHAT = "Can I find time with you to chat?";
const READ = "Do you read every letter?";

function labels(list: "headings" | "faqs") {
  return cy.get(`[data-list="${list}"] [data-label]`).then(($nodes) => {
    return [...$nodes].map((node) => (node.textContent ?? "").trim());
  });
}

function emulate(scheme: "light" | "dark") {
  cy.then(() =>
    Cypress.automation("remote:debugger:protocol", {
      command: "Emulation.setEmulatedMedia",
      params: { features: [{ name: "prefers-color-scheme", value: scheme }] },
    }),
  );
}

describe("reorder headings and FAQs", () => {
  beforeEach(() => {
    cy.request("POST", "/__reset");
    cy.viewport(390, 844);
  });

  it("reorders with the buttons on a phone and keeps that order after reload", () => {
    emulate("light");
    cy.visit("/reorder");
    cy.contains("FIXTURE — local reorder harness").should("be.visible");
    labels("headings").should("deep.equal", [CONSULT, TALK, SCIPY]);
    labels("faqs").should("deep.equal", [CHAT, READ]);
    cy.get(`button[aria-label="Move ${CONSULT} up"]`).should("be.disabled");
    cy.get(`button[aria-label="Move ${SCIPY} down"]`).should("be.disabled");
    cy.get(`button[aria-label="Move ${TALK} up"]`).should("be.enabled");
    cy.get(`button[aria-label="Move ${TALK} down"]`).should("be.enabled");
    cy.get(`button[aria-label="Move ${READ} down"]`).should("be.disabled");

    cy.get(`button[aria-label="Move ${TALK} up"]`).click();
    labels("headings").should("deep.equal", [TALK, CONSULT, SCIPY]);
    cy.get(`button[aria-label="Move ${TALK} up"]`).should("be.disabled");

    cy.get(`button[aria-label="Move ${CHAT} down"]`).focus().should("be.focused").click();
    labels("faqs").should("deep.equal", [READ, CHAT]);

    cy.reload();
    labels("headings").should("deep.equal", [TALK, CONSULT, SCIPY]);
    labels("faqs").should("deep.equal", [READ, CHAT]);
    cy.screenshot("fixture-reorder-dashboard-mobile-light", { capture: "fullPage" });

    emulate("dark");
    cy.reload();
    labels("headings").should("deep.equal", [TALK, CONSULT, SCIPY]);
    cy.get(`button[aria-label="Move ${TALK} up"]`).should("be.disabled");
    cy.screenshot("fixture-reorder-dashboard-mobile-dark", { capture: "fullPage" });

    emulate("light");
    cy.visit("/send/reorder");
    cy.contains("FIXTURE — local reorder harness").should("be.visible");
    cy.get("shortmail-widget")
      .shadow()
      .find("select option")
      .should(($options) => {
        expect([...$options].map((option) => option.textContent)).to.deep.equal([
          "Pick a subject…",
          TALK,
          CONSULT,
          SCIPY,
          "Other…",
        ]);
      });
    cy.get("shortmail-widget")
      .shadow()
      .find(".sm-faq-question")
      .should(($nodes) => {
        expect([...$nodes].map((node) => node.textContent)).to.deep.equal([READ, CHAT]);
      });
    cy.get("shortmail-widget").shadow().find("select").invoke("attr", "size", 5);
    cy.screenshot("fixture-reorder-send-mobile-light", { capture: "fullPage" });

    emulate("dark");
    cy.reload();
    cy.get("shortmail-widget").shadow().find("select option").should("have.length", 5);
    cy.get("shortmail-widget").shadow().find("select").invoke("attr", "size", 5);
    cy.screenshot("fixture-reorder-send-mobile-dark", { capture: "fullPage" });
  });
});
