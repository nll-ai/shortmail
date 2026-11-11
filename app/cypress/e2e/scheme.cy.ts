/// <reference types="cypress" />

export {};

const LIGHT = {
  background: "rgb(255, 255, 255)",
  foreground: "rgb(23, 23, 23)",
  muted: "rgb(82, 82, 82)",
  danger: "rgb(220, 38, 38)",
};

const DARK = {
  background: "rgb(10, 10, 10)",
  foreground: "rgb(237, 237, 237)",
  muted: "rgb(163, 163, 163)",
  danger: "rgb(252, 165, 165)",
};

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

function emulate(scheme: "light" | "dark") {
  cy.then(() =>
    Cypress.automation("remote:debugger:protocol", {
      command: "Emulation.setEmulatedMedia",
      params: { features: [{ name: "prefers-color-scheme", value: scheme }] },
    }),
  );
}

function expectPage(scheme: "light" | "dark", path: string) {
  const colors = scheme === "dark" ? DARK : LIGHT;
  emulate(scheme);
  cy.viewport(1280, 900);
  cy.visit(path);
  cy.get("body").should(($body) => {
    expect(getComputedStyle($body[0]).backgroundColor, path).to.eq(colors.background);
  });
  cy.get("h1").first().should(($heading) => {
    const color = getComputedStyle($heading[0]).color;
    expect(color, path).to.eq(colors.foreground);
    expect(contrast(color, colors.background), path).to.be.greaterThan(4.5);
  });
  cy.get(".text-muted").first().should(($node) => {
    const color = getComputedStyle($node[0]).color;
    const painted = getComputedStyle($node[0]).backgroundColor;
    const parent = getComputedStyle($node[0].parentElement ?? $node[0]).backgroundColor;
    const background = painted !== "rgba(0, 0, 0, 0)"
      ? painted
      : parent !== "rgba(0, 0, 0, 0)"
        ? parent
        : colors.background;
    expect(color, `${path} muted`).to.eq(colors.muted);
    expect(contrast(color, background), `${path} muted contrast`).to.be.greaterThan(4.5);
  });
}

function shadowColor(selector: string): Cypress.Chainable<string> {
  return cy.get("shortmail-widget").shadow().find(selector).then(($node) => {
    return getComputedStyle($node[0]).color;
  });
}

describe("system color scheme", () => {
  const pages = [
    "/theme/home",
    "/theme/verify",
    "/theme/missing",
    "/theme/auth-error",
    "/theme/error",
    "/theme/embed-docs",
    "/theme/dashboard",
    "/theme/theming",
    "/theme/embed",
    "/theme/analytics",
    "/theme/admin",
  ];

  for (const path of pages) {
    it(`follows light and dark on ${path}`, () => {
      expectPage("light", path);
      expectPage("dark", path);
    });
  }

  it("adapts the default letter form and keeps an explicit preset", () => {
    const open = (scheme: "light" | "dark", path: string) => {
      emulate(scheme);
      cy.viewport(390, 844);
      cy.visit(path);
      cy.get("shortmail-widget").shadow().contains("Send a shortmail").should("be.visible");
    };

    const overLimit = (scheme: "light" | "dark") => {
      open(scheme, "/theme/send");
      cy.get("shortmail-widget").then(($host) => {
        const colors = scheme === "dark" ? DARK : LIGHT;
        const background = getComputedStyle($host[0]).backgroundColor;
        const color = getComputedStyle($host[0]).color;
        expect(background).to.eq(colors.background);
        expect(color).to.eq(colors.foreground);
        expect(contrast(color, background)).to.be.greaterThan(4.5);
      });
      cy.get("shortmail-widget").shadow().find("textarea").type("x".repeat(501), { delay: 0 });
      shadowColor(".sm-counter-over").should("eq", scheme === "dark" ? DARK.danger : LIGHT.danger);
    };
    overLimit("light");
    overLimit("dark");

    open("light", "/theme/send-midnight");
    cy.get("shortmail-widget").then(($host) => {
      expect(getComputedStyle($host[0]).backgroundColor).to.eq("rgb(11, 16, 32)");
      expect(getComputedStyle($host[0]).color).to.eq("rgb(229, 231, 235)");
    });
    open("dark", "/theme/send-midnight");
    cy.get("shortmail-widget").then(($host) => {
      expect(getComputedStyle($host[0]).backgroundColor).to.eq("rgb(11, 16, 32)");
      expect(getComputedStyle($host[0]).color).to.eq("rgb(229, 231, 235)");
    });

    open("dark", "/theme/send-paper");
    cy.get("shortmail-widget").then(($host) => {
      expect(getComputedStyle($host[0]).backgroundColor).to.eq("rgb(250, 246, 239)");
      expect(getComputedStyle($host[0]).color).to.eq("rgb(59, 47, 36)");
    });

    open("dark", "/theme/send-custom");
    cy.get("shortmail-widget").shadow().find("button").then(($button) => {
      expect(parseFloat(getComputedStyle($button[0]).letterSpacing)).to.be.greaterThan(0);
    });
    cy.get("shortmail-widget").then(($host) => {
      expect(getComputedStyle($host[0]).backgroundColor).to.eq(DARK.background);
    });
  });
});
