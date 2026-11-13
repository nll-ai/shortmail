import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingHome } from "../src/components/landing/LandingHome";

/**
 * Static landing HTML for Cypress (no Convex, no Stripe checkout).
 *
 * :param css: Compiled Tailwind utilities for the landing layout.
 * :returns: A full HTML document.
 */
export function landingMarketingHtml(css: string): string {
  const body = renderToStaticMarkup(
    createElement(LandingHome, { foundingEligible: false }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>${css}</style></head><body class="antialiased"><p class="bg-neutral-900 px-4 py-2 text-xs tracking-wide text-white">FIXTURE — marketing landing, founding closed, no checkout</p>${body}</body></html>`;
}
