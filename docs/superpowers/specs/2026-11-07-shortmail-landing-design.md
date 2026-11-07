# ShortMail landing design

Status: approved direction, not implemented. Eric approved an owner-focused product page with a static, non-sending example on 2026-11-07. This file is the spec. Implement the landing only after this document is reviewed. The pull request that adds this file is documentation only.

The live homepage at `/` currently mounts `LandingLetter` with `demo`. The caption says the demo does not send. `handleSubmit` still `POST`s `/api/send/cce87ae9c1d7`. The replacement page removes that path.

## Decision

`/` is a quiet white page for someone who wants their own ShortMail page.

- Ground stays white, text stays ink, type stays the Geist Sans already loaded by the root layout. Do not revive the airmail envelope.
- "Create your page" is in the first viewport. "Sign in" is a quiet text link for someone who already has an account.
- The letter is a static, clearly fictional specimen. It is not a form. It does not post, and it does not load an owner config, a real vanity, or Eric's headings.
- `/send/[vanity]`, the widget submit path, Resend delivery, WorkOS, premium flags, and the dashboard stay as they are.

## Non-goals

- No DNS or domain cutover, production config, deployment, billing, or data change.
- No new checkout, upgrade button, or `mailto:` sales link on `/`.
- No widget change. The public widget renders FAQ questions and omits answers (`app/src/widget/shortmail-widget.ts`). This spec does not promise FAQ deflection and does not fix that.
- No edit to `app/src/widget/formSkin.ts`. Landing focus and target size are local to the landing links.
- No edit to root font loading in `app/src/app/layout.tsx`. Removing Geist there would be app-wide.
- Do not advertise the 200-send daily cap.

## Page

One column, `main` max width `42rem`, horizontal padding `1.5rem`, page background white. Order:

1. Header.
2. Hero, including the only "Create your page" link.
3. Fictional letter specimen.
4. "A free page".
5. "What is kept".
6. Footer.

The hero link is the only filled control. The specimen follows it so the letter cannot push the action below the first screen.

### Exact copy

Document title: `ShortMail`.

Meta description: `One link for short letters. 500 characters, delivered as email.`

Header wordmark: `ShortMail`.

Header link: `Sign in`. Href `/dashboard`.

Hero `h1`: `A page for the letters you want.`

Hero lede: `People write you at one link. Each letter is at most 500 characters. It arrives as ordinary email.`

Hero link: `Create your page`. Href `/dashboard`.

Specimen caption, before the letter: `Fictional example. This is not a form, and nothing on it can be sent.`

Specimen definition list:

- To: `Sample Owner`
- From: `A. Visitor, visitor@example.com`
- Subject headings an owner might publish: `A question about your work`, `An invitation to talk`, `A note of thanks`
- Letter: `Hello. I have one specific question about the paper you posted in March. Is the dataset public?`
- Length: `95/500`
- Reply requested: `No`

The three headings are invented examples. Render them as text. The path below is also text, not a link.

Section `h2`: `A free page`

1. `Create your page. A free account gets a generated link, shaped like /send/ada-1a2b3c. Signup does not let you choose that name.`
2. `You can publish up to 5 subject headings. Visitors pick one of yours, or write their own. A free account can also save 3 FAQ entries. Visitors do not see those answers on the letter page.`
3. `The letter arrives as email. Analytics, theming, an embed, and a custom link name are paid-account features. This page does not take payment.`

`ada-1a2b3c` illustrates the shape only. The real link is `{email local-part, lowercased, characters outside a-z 0-9 _ - removed, at most 30 characters}-{last 6 characters of the WorkOS subject}` from `getOrCreateCurrentUser`. Do not claim a visitor receives those exact six characters.

Section `h2`: `What is kept`

`The letter is delivered as email to you. ShortMail does not keep the letter body in its database. The visitor's name and email are required, and both are on the email you receive, so the visitor is not anonymous. ShortMail does not put a copy in the visitor's sent folder. It does store the subject, including whether a reply was requested, and aggregate events for page views and successful sends.`

Footer text: `© Nonlinear Labs · BUSL-1.1` and `One account, one email.` Color may darken to meet the contrast rule below. The words stay.

Copy must not say that senders are anonymous, that nothing is stored, that a copy lands in a sent folder, that a free account chooses its link name, that FAQ answers deflect questions, or that premium can be bought on this page.

## Components

| Piece | File | Behavior |
|---|---|---|
| Landing page | `app/src/app/page.tsx` | Server component. Owns the copy, both links, landmarks, and landing metadata. |
| Specimen | `app/src/components/LetterSpecimen.tsx` | Server component. No `"use client"`. Static `figure` and `dl`. |
| Removed | `app/src/components/LandingLetter.tsx` | Delete it. After this change nothing imports it. The file is the live POST. |

`LetterSpecimen` contains no `form`, `input`, `textarea`, `select`, `button`, or `contenteditable`. It imports neither `sendUrl` nor `configUrl`. It does not render `<shortmail-widget>`.

Both account links are `<a href="/dashboard">`. `/dashboard` already calls `withAuth({ ensureSignedIn: true })`. This PR does not add a second signup URL and does not change that gate. "Create your page" and "Sign in" share a destination on purpose: WorkOS already separates a new sign-up from a returning sign-in. The landing only changes the visible names and weights.

## Data flow

`GET /` returns the static server render. The page component runs no Convex query and no `fetch`. It does not read `NEXT_PUBLIC_CONVEX_URL` and does not call `/api/embed/{vanity}/config`, `/api/send/{vanity}`, or `/api/collect/{vanity}`.

A click navigates to `/dashboard`. Sign-in, user creation, vanity generation, and mail stay on their current routes.

The root layout may still wrap `/` in `ConvexClientProvider` and AuthKit. Leave that wrap in place. A WorkOS session probe from that provider is existing behavior and is out of scope. It is not an owner-config fetch and it is not a send.

What a real letter does, unchanged, and therefore what the privacy paragraph is allowed to say:

- Name and email are required (`app/convex/lib/sendRequest.ts`).
- The body is not a Convex table. It is the Resend email body.
- The sender does not send from their own mail client, so there is no ShortMail-created sent-folder copy.
- `events` stores `form_view` and `send_success`. `send_success.subject` is the tagged subject (`[RN]` or `[NRN]`), which is how the reply preference is stored.
- Name and email are not columns on `events`.
- The public privacy sentence means there is no letter record in the application schema. The email action still receives the body long enough to hand it to Resend. Do not add a `messages` table, and do not claim that an in-flight action payload is impossible.

## Error handling

`/` has nothing to submit, so it has no validation message, disabled control, or retry state. Do not add a landing error banner for a request the page must not make.

Auth failures, mailbox failures, and the daily send cap stay on the existing dashboard, widget, and HTTP handlers. Do not restyle them here.

## Accessibility

Landing-scoped. Do not change shared form skin, the widget, or the dashboard.

- One `h1` (the hero). The specimen is a `figure` named by its `figcaption`, not a heading. The following headings are `h2` "A free page" and `h2` "What is kept". No skipped level, and no second `h1`.
- Landmarks: `header`, `main`, `footer`.
- The fictional caption is text at the start of the `figure`, not color alone and not a background image.
- "Sign in" and "Create your page" are links with a hit box of at least 44×44 CSS pixels. Quiet means unfilled: neutral text, no solid black rectangle. The hit box comes from padding, not from a smaller font.
- Keyboard: both links are in tab order. `:focus-visible` shows a 2px solid `#171717` outline, offset 2px. Resting mouse clicks do not need that ring. The specimen has no tab stop.
- Text on white is at least 4.5:1. Use `#171717` for the heading and body. Use `#525252` or darker for the lede, caption, and footer. Do not use `#737373` for the 12px footer.
- "Create your page" is white `#ffffff` on `#171717`.
- No new motion. No image that needs alt text.

## Responsive

- At 320, 390, and 1440 CSS pixels wide, `documentElement.scrollWidth` is at most `clientWidth + 1`.
- At 390×844 and at 1440×900, the bottom of "Create your page" is above the bottom of the viewport on first paint.
- The specimen stacks in one column at every width above. The example path wraps inside the column (`overflow-wrap: anywhere` on that line only).
- No horizontal carousel, no fixed-width letter, no viewport-locked font size.

## Fonts

On the landing root only, set `font-family` to `var(--font-geist-sans), sans-serif`. That uses the variable `layout.tsx` already defines, so the homepage reads in the face the app already ships. Do not add Courier, a display face, or another `next/font` call. Geist Mono stays on the root layout because removing it would change every route. The landing page does not set a monospace font.

## Test plan

Tests use fixtures and network mocks. They must not send mail, create a WorkOS user, or complete a signup.

`app/src/components/LetterSpecimen.test.tsx`, Vitest and jsdom:

- Rendered markup contains the caption, the sample letter, `95/500`, and `visitor@example.com`.
- Markup contains no `form`, `input`, `textarea`, `select`, `button`, `shortmail-widget`, `cce87ae9c1d7`, or the live headings "I'd like you to consult for me" and "SciPy 2026 Fundraiser".
- Rendering calls `fetch` zero times.

`app/src/app/landing.source.test.ts`:

- `app/src/app/page.tsx` has exactly one anchor whose accessible name is `Create your page` and exactly one whose accessible name is `Sign in`. Both `href` values are `/dashboard`. The words "Create your page" may also appear in the free-page list as prose.
- It does not import `LandingLetter`, `sendUrl`, `configUrl`, or `shortmail-widget`.
- `app/src/components/LandingLetter.tsx` is absent.
- `app/src/widget/shortmail-widget.ts` still contains `/api/send/`. This guards the real send path while the homepage demo is removed.
- The implementation diff against `main` does not modify `app/src/widget/formSkin.ts` or `app/src/app/layout.tsx`. Check with `git diff main -- app/src/widget/formSkin.ts app/src/app/layout.tsx`.

`app/e2e/landing.spec.ts`, Playwright, devDependency only. Boot with the existing local env. Do not add or rotate production keys to run it.

- Intercept requests. Fail the test if any URL contains `/api/send`, `/api/embed`, `/api/collect`, or `api.resend.com`. A Convex websocket or a WorkOS session probe from the existing provider is not, by itself, a failure. An embed config fetch is a failure.
- Do not type into a login form and do not submit one.
- Viewports 320×700, 390×844, and 1440×900: no horizontal overflow, as defined above.
- At 390×844 and 1440×900, "Create your page" is inside the first viewport.
- Tab reaches "Sign in" and "Create your page". The focused link's computed outline style is not `none` and the outline width is at least 2px.
- Visible text includes the exact "What is kept" paragraph and the FAQ sentence "Visitors do not see those answers on the letter page."

Regression, mocks only:

- Run `app/convex/lib/sendRequest.test.ts` unchanged. It already covers required name and email, the 500-character rule, and `[RN]` / `[NRN]` tagging.
- Do not add a test that calls Resend or the production Convex site.

## Implementation gate

Do not start the landing change until this spec is reviewed. A review change to copy, section order, or the shared `/dashboard` destination updates this file first.
