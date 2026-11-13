import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FOUNDING_CENTS_YEARLY,
  PREMIUM_CENTS_YEARLY,
} from "../../shared/billing/config";
import { LandingHome } from "@/components/landing/LandingHome";
import { formatYearlyDollars } from "@/app/landing/formatPrice";
import { LANDING_PRIVACY_PARAGRAPH } from "@/app/landing/privacy";

const standardYearly = formatYearlyDollars(PREMIUM_CENTS_YEARLY);
const foundingYearly = formatYearlyDollars(FOUNDING_CENTS_YEARLY);

describe("homepage", () => {
  it("offers two account links and the approved copy", () => {
    const html = renderToStaticMarkup(
      createElement(LandingHome, { foundingEligible: false }),
    );
    const create = html.match(
      /<a[^>]*href="\/dashboard"[^>]*>Create your page<\/a>/g,
    );
    const signIn = html.match(
      /<a[^>]*href="\/dashboard"[^>]*>Sign in<\/a>/g,
    );

    expect(create).toHaveLength(1);
    expect(signIn).toHaveLength(1);
    expect(html.replaceAll("&#x27;", "'")).toContain(LANDING_PRIVACY_PARAGRAPH);
    expect(html).toContain("A link for the letters you are willing to read.");
    expect(html).toContain("allowlist of up to 20 sites");
    expect(html).toContain("This page does not charge a card");
    expect(html).toContain("Will this stop all my email?");
    expect(html).toContain("A fictional page. Nothing on this card is sent.");
    expect(html).toContain("189/500");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("shortmail-widget");
    expect(html).not.toContain("cce87ae9c1d7");
    expect(html).toContain(`${standardYearly} a year.`);
    expect(html).not.toContain(`Founding price ${foundingYearly}`);
  });

  it("mentions founding price only when eligible", () => {
    const html = renderToStaticMarkup(
      createElement(LandingHome, { foundingEligible: true }),
    );
    expect(html).toContain(`Founding price ${foundingYearly} a year.`);
    expect(html).toContain(standardYearly);
    expect(html).toContain(foundingYearly);
  });

  it("does not import the live send demo", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain("loadFoundingEligible");
    expect(source).toContain("LandingHome");
    const landingSource = readFileSync(
      new URL("../components/landing/LandingHome.tsx", import.meta.url),
      "utf8",
    );
    expect(landingSource).toContain("min-h-11");
    expect(landingSource).toContain("focusClass");
    const controls = readFileSync(
      new URL("../theme/controls.ts", import.meta.url),
      "utf8",
    );
    expect(controls).toContain("focus-visible:outline-2");
    expect(landingSource).toContain(
      'fontFamily: "var(--font-geist-sans), sans-serif"',
    );
    expect(source).not.toContain("LandingLetter");
    expect(source).not.toContain("sendUrl");
    expect(source).not.toContain("configUrl");
    expect(source).not.toContain("shortmail-widget");
    expect(
      existsSync(new URL("../components/LandingLetter.tsx", import.meta.url)),
    ).toBe(false);
  });

  it("keeps the send path and shares the adaptive color scheme", () => {
    const widget = readFileSync(
      new URL("../widget/shortmail-widget.ts", import.meta.url),
      "utf8",
    );
    expect(widget).toContain("/api/send/");
    expect(widget).toContain("session_secret");
    expect(widget).toContain("color-scheme: light dark");
    expect(widget).not.toMatch(/color-scheme:\s*light\s*;/);

    const skin = readFileSync(
      new URL("../widget/formSkin.ts", import.meta.url),
      "utf8",
    );
    expect(skin).toContain("ADAPTIVE");

    const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain('colorScheme: "light dark"');
  });
});
