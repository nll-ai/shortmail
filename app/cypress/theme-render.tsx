import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";
import VerifyPage from "../src/app/verify/page";
import NotFound from "../src/app/not-found";
import AuthError from "../src/app/auth/error/page";
import EmbedDocs from "../src/app/embed-docs/page";
import RouteError from "../src/app/error";
import { SendFrame } from "../src/app/send/SendFrame";
import { controlClass, fieldClass, primaryClass, codeBlockClass } from "../src/theme/controls";

const shell = (title: string, body: string) =>
  `<main class="mx-auto min-h-svh max-w-3xl bg-background p-8 text-foreground"><h1 class="text-2xl font-bold">${title}</h1>${body}</main>`;

const dashboard = shell(
  "ShortMail Dashboard",
  `<p class="mt-2">Signed in as <strong>fixture@example.com</strong></p>
   <form class="mt-4"><button id="sign-out" class="inline-flex min-h-11 items-center px-1 text-sm font-medium text-foreground underline" type="button">Sign out</button></form>
   <section class="mt-6 border p-4 text-sm">
     <h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em]">Your send page</h2>
     <p>Visitors write to you at <span class="font-mono underline">/send/fixture</span></p>
     <p class="mt-2 text-xs text-muted">Custom vanity names are a paid-account feature.</p>
     <form class="mt-4 flex flex-col gap-2">
       <input class="${fieldClass}" placeholder="New subject heading" value="Data request" />
       <button class="${controlClass}" type="button">Add</button>
     </form>
   </section>
   <p class="mt-6 text-xs uppercase tracking-wide text-muted">Live preview — what your visitors see</p>
   <div id="frame" class="border border-line bg-background p-6"><shortmail-widget vanity="fixture"></shortmail-widget></div>`,
);

const theming = shell(
  "Theming",
  `<p class="mt-1 text-sm text-muted">Make your send form yours — presets, custom CSS, live preview.</p>
   <div class="mt-6 flex flex-wrap gap-2">
     <button class="border border-accent bg-accent px-4 py-1.5 text-sm text-accent-foreground" type="button">Default</button>
     <button class="border border-line bg-background px-4 py-1.5 text-sm text-foreground" type="button">Midnight</button>
   </div>
   <textarea class="mt-4 w-full border border-line bg-background p-3 font-mono text-xs text-foreground" rows="4">button { letter-spacing: 0.02em; }</textarea>
   <button class="mt-4 ${primaryClass}" type="button">Save theme</button>
   <p class="mt-2 text-sm text-success">Saved</p>`,
);

const embed = shell(
  "Embed your form",
  `<pre class="${codeBlockClass}">&lt;shortmail-widget vanity="fixture"&gt;&lt;/shortmail-widget&gt;</pre>
   <p class="mt-2 text-xs text-muted">Paste into any HTML page.</p>
   <textarea class="mt-4 w-full border border-line bg-background p-3 font-mono text-xs text-foreground" rows="3">https://example.com</textarea>
   <button class="mt-4 ${primaryClass}" type="button">Save origins</button>`,
);

const analytics = shell(
  "Analytics",
  `<p class="mt-1 text-sm text-muted">Form views and messages for your send page, last 30 days.</p>
   <div class="mt-6 border border-info-border bg-info-bg p-6 text-info-foreground">
     <h2 class="text-lg font-semibold">Analytics is a premium feature</h2>
     <a class="mt-4 inline-block ${primaryClass}" href="mailto:eric.ma@nonlinearlabs.ai">Upgrade to premium</a>
   </div>
   <div class="mt-6 grid grid-cols-3 gap-4">
     <div class="border p-4"><p class="text-xs uppercase text-muted">Views (30d)</p><p class="text-2xl font-bold">12</p></div>
     <div class="border p-4"><p class="text-xs uppercase text-muted">Messages sent (30d)</p><p class="text-2xl font-bold">3</p></div>
   </div>`,
);

const admin = shell(
  "Admin",
  `<p class="border border-danger-border bg-danger-bg p-4 text-sm text-danger-foreground">Admin access required.</p>
   <section class="mt-6 border p-4">
     <p class="text-xs uppercase text-muted">Total users</p>
     <p class="text-2xl font-bold">4</p>
   </section>
   <button class="mt-4 border border-success px-3 py-0.5 text-xs text-success" type="button">paid</button>
   <button class="ml-2 border border-line px-3 py-0.5 text-xs text-muted" type="button">free</button>`,
);

/**
 * Static markup for the scheme suite. Public routes are the real components.
 * Signed-in routes are fixture markup using the same tokens, because Cypress
 * has no AuthKit session.
 */
export function themePages(): Record<string, string> {
  return {
    "/theme/home": renderToStaticMarkup(createElement(Home)),
    "/theme/verify": renderToStaticMarkup(createElement(VerifyPage)),
    "/theme/missing": renderToStaticMarkup(createElement(NotFound)),
    "/theme/auth-error": renderToStaticMarkup(createElement(AuthError)),
    "/theme/embed-docs": renderToStaticMarkup(createElement(EmbedDocs)),
    "/theme/error": renderToStaticMarkup(
      createElement(RouteError, { error: new Error("fixture"), reset: () => undefined }),
    ),
    "/theme/send": renderToStaticMarkup(
      createElement(SendFrame, { vanityName: "fixture", theme: null }),
    ),
    "/theme/send-midnight": renderToStaticMarkup(
      createElement(SendFrame, {
        vanityName: "midnight",
        theme: { preset: "midnight", customCss: null },
      }),
    ),
    "/theme/send-paper": renderToStaticMarkup(
      createElement(SendFrame, {
        vanityName: "paper",
        theme: { preset: "paper", customCss: null },
      }),
    ),
    "/theme/send-custom": renderToStaticMarkup(
      createElement(SendFrame, {
        vanityName: "custom",
        theme: { preset: "default", customCss: "button { letter-spacing: 0.2em; }" },
      }),
    ),
    "/theme/dashboard": dashboard,
    "/theme/theming": theming,
    "/theme/embed": embed,
    "/theme/analytics": analytics,
    "/theme/admin": admin,
  };
}
