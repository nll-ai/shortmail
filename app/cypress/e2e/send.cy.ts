/// <reference types="cypress" />

export {};

/**
 * The real widget bundle, against the fixture server. No Convex write and
 * no email. These cases are the Nov 10 production no-op: a confirmed
 * sender, subject Other…, custom subject TEST, message TEST.
 */

const EMAIL = "ericmjl@icloud.com";

function shadow() {
  return cy.get("shortmail-widget").shadow();
}

function proof(status: "confirmed" | "pending") {
  return {
    email: EMAIL,
    challengeId: "challenge",
    challengeSecret: "challenge-secret",
    sessionSecret: "session-secret",
    status,
    sessionExpiresAt: status === "confirmed" ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null,
  };
}

function visitWith(record: ReturnType<typeof proof>) {
  cy.visit("/send/fixture", {
    onBeforeLoad(win) {
      win.localStorage.setItem("shortmail.sender.v1", JSON.stringify(record));
    },
  });
  shadow().contains("h3", "Send a shortmail").should("be.visible");
}

function withForm(run: (root: ShadowRoot) => void) {
  cy.get("shortmail-widget").then(($host) => {
    const root = $host[0].shadowRoot;
    if (!root) throw new Error("widget shadow root missing");
    run(root);
  });
}

function setValue(root: ShadowRoot, selector: string, value: string) {
  const el = root.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (!el) throw new Error(selector);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillLetter(root: ShadowRoot) {
  const name = [...root.querySelectorAll("input.sm-input")].find(
    (el) => !(el as HTMLInputElement).placeholder,
  ) as HTMLInputElement | undefined;
  if (!name) throw new Error("name field missing");
  name.value = "Eric Ma";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  setValue(root, 'input[type="email"]', EMAIL);
  setValue(root, "select", "OTHER");
  setValue(root, 'input[placeholder="Your own subject"]', "TEST");
  setValue(root, "textarea", "TEST");
}

function clickSend(root: ShadowRoot) {
  const button = [...root.querySelectorAll("button")].find((el) => el.textContent === "Send shortmail");
  if (!button) throw new Error("send button missing");
  button.click();
}

function fillAndSend(prepare?: (root: ShadowRoot) => void) {
  cy.get("shortmail-widget").then(($host) => {
    const root = $host[0].shadowRoot;
    if (!root) throw new Error("widget shadow root missing");
    prepare?.(root);
    fillLetter(root);
    expect(root.querySelector(".sm-counter")?.textContent, "message was filled").to.eq("4/500");
    clickSend(root);
  });
}

describe("confirmed send in the real widget", () => {
  beforeEach(() => {
    cy.request("POST", "/__reset");
  });

  it("posts Other… plus a custom subject for a confirmed sender", () => {
    visitWith(proof("confirmed"));
    shadow().contains("Nothing is sent until you do").should("be.visible");
    fillAndSend((root) => {
      expect(root.querySelector('input[name="website"]'), "autofill name").to.equal(null);
      const honeypot = root.querySelector('input[name="shortmail_leave_blank"]') as HTMLInputElement | null;
      expect(honeypot, "honeypot").to.not.equal(null);
      expect(honeypot?.readOnly).to.equal(true);
    });
    cy.request("/__send").its("body").should((sends: Record<string, string>[]) => {
      expect(sends).to.have.length(1);
      expect(sends[0].sender_name).to.eq("Eric Ma");
      expect(sends[0].sender_email).to.eq(EMAIL);
      expect(sends[0].reply_needed).to.eq("no");
      expect(sends[0].subject).to.eq("OTHER");
      expect(sends[0].custom_subject).to.eq("TEST");
      expect(sends[0].message).to.eq("TEST");
      expect(sends[0].website).to.eq("");
      expect(sends[0].session_secret).to.eq("session-secret");
    });
  });

  it("posts that same letter after a reload", () => {
    visitWith(proof("confirmed"));
    cy.reload();
    shadow().contains("Nothing is sent until you do").should("be.visible");
    shadow().find('input[type="email"]').should("have.value", EMAIL);
    fillAndSend();
    cy.request("/__send").its("body").should((sends: Record<string, string>[]) => {
      expect(sends).to.have.length(1);
      expect(sends[0].subject).to.eq("OTHER");
      expect(sends[0].custom_subject).to.eq("TEST");
      expect(sends[0].message).to.eq("TEST");
    });
  });

  it("says which field is missing instead of ignoring the click", () => {
    visitWith(proof("confirmed"));
    withForm((root) => clickSend(root));
    shadow().contains("Add your name, a subject, and a message").should("be.visible");
    withForm((root) => {
      const name = [...root.querySelectorAll("input.sm-input")].find(
        (el) => !(el as HTMLInputElement).placeholder,
      ) as HTMLInputElement;
      name.value = "Eric Ma";
      setValue(root, 'input[type="email"]', EMAIL);
      setValue(root, "textarea", "TEST");
      clickSend(root);
    });
    shadow().contains("Add a subject before the letter can be sent.").should("be.visible");
    withForm((root) => {
      setValue(root, "select", "OTHER");
      clickSend(root);
    });
    shadow().contains("Add your own subject before the letter can be sent.").should("be.visible");
    cy.request("/__send").its("body").should("have.length", 0);
  });

  it("explains a filled hidden field instead of swallowing the click", () => {
    visitWith(proof("confirmed"));
    withForm((root) => {
      fillLetter(root);
      const honeypot = root.querySelector('input[name="shortmail_leave_blank"]') as HTMLInputElement;
      honeypot.value = EMAIL;
      clickSend(root);
    });
    shadow().contains("hidden field was filled").should("be.visible");
    shadow().contains("Message sent").should("not.exist");
    cy.request("/__send").its("body").should("have.length", 0);
  });

  it("shows the code box and Confirm after reload while a code is pending", () => {
    visitWith(proof("pending"));
    shadow().find('input[type="email"]').should("have.value", EMAIL);
    shadow().find('input[placeholder="Paste the code from your email"]').should("be.visible");
    shadow().contains("button", "Confirm email").should("be.visible");
    shadow().contains("Check your email, enter the code").should("be.visible");
    shadow().contains("button", "Send shortmail").should("not.be.visible");
    cy.request("/__calls").its("body").then((body: string[]) => {
      expect(body.join("\n")).not.to.contain("/api/send/");
    });
  });
});
