/// <reference types="cypress" />

describe("Premium upgrade (fixture)", () => {
  beforeEach(() => {
    cy.visit("/billing/free");
  });

  it("shows the upgrade button and mocked post-checkout Premium state", () => {
    cy.contains("FIXTURE — mocked Stripe checkout").should("be.visible");
    cy.contains("Upgrade to Premium").should("be.visible");
    cy.get("#upgrade-btn").click();
    cy.url().should("include", "/billing/success");
    cy.contains("Premium active").should("be.visible");
    cy.contains("Payment received").should("be.visible");
    cy.screenshot("billing-fixture-premium-active", { capture: "viewport" });
  });
});
