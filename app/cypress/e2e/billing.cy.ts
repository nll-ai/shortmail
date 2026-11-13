/// <reference types="cypress" />

describe("Premium billing (fixture)", () => {
  it("dashboard free state", () => {
    cy.visit("/billing/free");
    cy.contains("FIXTURE — mocked Stripe checkout").should("be.visible");
    cy.contains("Upgrade to Premium").should("be.visible");
    cy.screenshot("fixture-dashboard-billing-free", { capture: "viewport" });
  });

  it("mocked checkout success shows interim banner", () => {
    cy.visit("/billing/free");
    cy.get("#upgrade-btn").click();
    cy.url().should("include", "/billing/success");
    cy.contains("Payment received").should("be.visible");
    cy.contains("Premium active").should("be.visible");
  });

  it("dashboard Premium active without success banner", () => {
    cy.visit("/billing/premium");
    cy.contains("FIXTURE — mocked Stripe checkout").should("be.visible");
    cy.contains("Premium active").should("be.visible");
    cy.contains("Payment received").should("not.exist");
    cy.contains("Manage billing").should("be.visible");
    cy.screenshot("fixture-dashboard-billing-premium", { capture: "viewport" });
  });
});

describe("Admin comp Premium (fixture)", () => {
  it("shows comp kind selector and Comp / period column", () => {
    cy.visit("/admin/users");
    cy.contains("FIXTURE — admin comp UI").should("be.visible");
    cy.get("#comp-kind-select").should("be.visible");
    cy.contains("Free for one year").should("be.visible");
    cy.contains("Comp / period").should("be.visible");
    cy.contains("One year (ends)").should("be.visible");
    cy.contains("Comp Premium").should("be.visible");
    cy.screenshot("fixture-admin-users-comp", { capture: "viewport" });
  });
});
