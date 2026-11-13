# ShortMail landing design

Status: approved for implementation on 2026-11-07 (specimen v2). Updated 2026-11-13 for pain, Premium positioning, and public pricing copy aligned with PR #49 billing. This file is the spec.

## Decision

`/` is a quiet owner-focused page for busy professionals and academics who want a ShortMail contact link.

- Ground follows the system color scheme (`color-scheme: light dark` via the root layout). Type stays Geist Sans on the landing root only. Do not revive the airmail envelope.
- "Create your page" is in the first viewport at 390×844 and 1440×900. "Sign in" is a quiet text link for someone who already has an account.
- The letter is a static, clearly fictional specimen. It is not a form. It does not post, and it does not load an owner config, a real vanity, or Eric's headings. The caption adds: `A fictional page. Nothing on this card is sent.`
- `/send/[vanity]`, the widget submit path, Resend delivery, WorkOS, premium flags, the dashboard, and Stripe checkout stay as they are. This page does not charge a card and does not host a checkout button.

## Non-goals

- No DNS or domain cutover, production config, deployment, or Stripe checkout on `/`.
- No widget change for this copy pass.
- No edit to `app/src/widget/formSkin.ts`. Landing focus and target size are local to the landing links.
- No edit to root font loading in `app/src/app/layout.tsx`.
- Do not advertise the 200-send daily cap.

## Page

One column, `main` max width `42rem`, horizontal padding `1.5rem`. Order:

1. Header.
2. Hero, including the only filled "Create your page" link.
3. Fictional letter specimen.
4. "The long letter" (pain / outcome).
5. "How a letter gets to you".
6. "Free and Premium".
7. "Price" (amounts from `app/shared/billing/config.ts`; founding line only when `api.billing.foundingStatus` reports `eligible: true`).
8. "What is kept".
9. "Questions" (FAQ).
10. Footer.

The hero link is the only filled control. The specimen follows it so the letter cannot push the action below the first screen on the tested viewports.

### Exact copy

Document title: `ShortMail`.

Meta description: `One link instead of your email address. 500 characters, delivered to the inbox you already use.`

Header wordmark: `ShortMail`.

Header link: `Sign in`. Href `/dashboard`.

Hero `h1`: `A link for the letters you are willing to read.`

Hero lede: `Publish one link instead of your email address. People write at most 500 characters, on the subjects you name. The letter arrives in the inbox you already use.`

Hero link: `Create your page`. Href `/dashboard`.

Specimen caption: `Example`, then `A fictional page. Nothing on this card is sent.`

Specimen body: unchanged Adeyemi / Ruiz example (189/500, Data request selected).

Section `h2`: `The long letter` — pain paragraph per `app/src/components/landing/LandingHome.tsx`.

Section `h2`: `How a letter gets to you` — four numbered steps (generated link, headings/FAQs, verification, delivery).

Section `h2`: `Free and Premium` — free tier list; Premium includes unlimited headings/FAQs, custom vanity, analytics (30 days), theming presets + custom CSS, and an embed allowlist (up to 20 origins). Do not claim that embedding itself is Premium-gated; only saving the allowlist is.

Section `h2`: `Price` — `${formatYearlyDollars(PREMIUM_CENTS_YEARLY)} a year.` Optional founding sentence when eligible. Mention `DEFAULT_FOUNDING_CAP` and `DEFAULT_FOUNDING_WINDOW_DAYS` when founding is eligible. Close with dashboard upgrade / Manage billing; `This page does not charge a card.`

Section `h2`: `What is kept` — privacy paragraph in `app/src/app/landing/privacy.ts`.

Section `h2`: `Questions` — FAQ entries in `LandingHome.tsx` (no refunds promised).

Footer: `© Nonlinear Labs · BUSL-1.1`, `Connect an agent`, `One account, one email.`

Copy must not say that senders are anonymous, that nothing is stored, that a copy lands in a sent folder, that a free account chooses its link name, or that premium can be bought on this page.

## Components

| Piece | File | Behavior |
|---|---|---|
| Landing page | `app/src/app/page.tsx` | Async server component. Calls `loadFoundingEligible` once, renders `LandingHome`. |
| Landing body | `app/src/components/landing/LandingHome.tsx` | Sync server markup. Owns section copy and links. |
| Founding read | `app/src/app/landing/loadFoundingEligible.ts` | Single unauthenticated `api.billing.foundingStatus` query via `ConvexHttpClient`. Failure → founding closed. |
| Specimen | `app/src/components/LetterSpecimen.tsx` | Static figure. No network. |

Both account links are `<a href="/dashboard">`. Checkout remains on the dashboard via `POST /api/billing/checkout`.

## Data flow

`GET /` may perform exactly one Convex query: `api.billing.foundingStatus` (no auth). It must not call `/api/embed/{vanity}/config`, `/api/send/{vanity}`, or `/api/collect/{vanity}`.

## Accessibility

- One `h1` (the hero). Specimen is a `figure`. Section titles are `h2`. FAQ questions are `dt` / `dd`.
- Landmarks: `header`, `main`, `footer`.
- "Sign in" and "Create your page" links ≥ 44×44 CSS pixels. `:focus-visible` outline ≥ 2px (from `focusClass`).

## Responsive

- At 320, 390, and 1440 CSS pixels wide, no horizontal overflow.
- At 390×844 and 1440×900, "Create your page" is inside the first viewport on first paint.

## Test plan

`app/src/components/LetterSpecimen.test.tsx` — static specimen, fictional line, no controls.

`app/src/app/landing.source.test.ts` — account links, privacy text, price copy, no live send imports.

`app/e2e/landing.spec.ts` — Puppeteer against a local static render (local-only; CI uses Cypress). Viewport CTA, overflow, privacy, FAQ.

`app/cypress/e2e/landing.cy.ts` — fixture route `/landing`: CTA in viewport, pain/premium/privacy copy, light/dark body background.

`app/src/app/landing/loadFoundingEligible.test.ts` — failure → false, eligible query → true.

## Implementation gate

Copy changes ship in the same pull request as updates to this file.
