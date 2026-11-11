/// <reference types="cypress" />

const CONSULT = "I'd like you to consult for me";
const TALK = "I'd like to invite you to give a talk";
const SCIPY = "SciPy 2026 Fundraiser";
const CHAT = "Can I find time with you to chat?";
const READ = "Do you read every letter?";

function expectLabels(list: "headings" | "faqs", expected: string[]) {
  cy.get(`[data-list="${list}"] [data-label]`).should(($nodes) => {
    expect([...$nodes].map((node) => (node.textContent ?? "").trim())).to.deep.equal(expected);
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

function handle(label: string) {
  return cy.get(`button[aria-label="Drag to reorder ${label}"]`);
}

/**
 * Touch events, the same ones iPhone Safari sends. Dispatched on the handle
 * because that is where the touch sensor listens.
 */
function dragHandle(fromLabel: string, toLabel: string, shot?: string) {
  handle(fromLabel).then(($from) => {
    handle(toLabel).then(($to) => {
      const from = $from[0].getBoundingClientRect();
      const to = $to[0].getBoundingClientRect();
      const el = $from[0];
      const view = el.ownerDocument.defaultView;
      if (!view) throw new Error("missing window");
      const x = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const y1 = to.top + to.height / 2;
      const fire = (type: string, y: number) => {
        const touch = new view.Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(
          new view.TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === "touchend" ? [] : [touch],
            targetTouches: type === "touchend" ? [] : [touch],
            changedTouches: [touch],
          }),
        );
      };
      fire("touchstart", y0);
      fire("touchmove", y1);
      cy.get("[data-drag-overlay]").should("be.visible");
      cy.get("[data-over='true']").should("exist");
      cy.then(() => fire("touchmove", y1));
      cy.get("[data-over='true']").should("exist");
      if (shot) {
        cy.screenshot(shot, { capture: "viewport" });
        return;
      }
      cy.then(() => fire("touchend", y1));
    });
  });
}

describe("reorder headings and FAQs", () => {
  beforeEach(() => {
    cy.request("POST", "/__reset");
    cy.viewport(390, 844);
  });

  it("reorders by dragging the handle on a phone and keeps that order after reload", () => {
    emulate("light");
    cy.visit("/reorder");
    cy.contains("FIXTURE — local reorder harness").should("be.visible");
    expectLabels("headings", [CONSULT, TALK, SCIPY]);
    expectLabels("faqs", [CHAT, READ]);
    handle(TALK).should("be.visible").and("have.attr", "aria-roledescription", "sortable");

    dragHandle(TALK, CONSULT);
    expectLabels("headings", [TALK, CONSULT, SCIPY]);
    cy.get("button[aria-label^='Move ']").should("not.exist");

    // Space lifts the handle, ArrowDown moves it, Space drops it.
    cy.window().then((win) => {
      const button = [...win.document.querySelectorAll("button")].find(
        (node) => node.getAttribute("aria-label") === `Drag to reorder ${CHAT}`,
      );
      if (!(button instanceof win.HTMLElement)) throw new Error("missing faq handle");
      button.focus();
      button.dispatchEvent(
        new win.KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true }),
      );
    });
    cy.get("[data-drag-overlay]").should("contain.text", CHAT);
    cy.wait(50);
    cy.window().then((win) => {
      win.document.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          code: "ArrowDown",
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    cy.wait(50);
    cy.window().then((win) => {
      win.document.dispatchEvent(
        new win.KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true }),
      );
    });
    expectLabels("faqs", [READ, CHAT]);

    cy.reload();
    expectLabels("headings", [TALK, CONSULT, SCIPY]);
    expectLabels("faqs", [READ, CHAT]);
    cy.screenshot("fixture-reorder-dashboard-mobile-light", { capture: "fullPage" });

    emulate("dark");
    cy.reload();
    expectLabels("headings", [TALK, CONSULT, SCIPY]);
    handle(TALK).should("be.visible");
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

    emulate("light");
    cy.visit("/reorder");
    dragHandle(TALK, SCIPY, "fixture-reorder-mid-drag-mobile-light");
  });
});
