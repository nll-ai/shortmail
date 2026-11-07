# ShortMail landing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage letter form with the approved static v2 page: owner-focused copy, a fictional Adeyemi/Ruiz specimen, and no send or config request.

**Architecture:** `app/src/app/page.tsx` is a server component that owns the marketing copy and the two `/dashboard` links. `LetterSpecimen` is a server component with no client hooks and no network. The live `LandingLetter` module is deleted so the homepage cannot POST. Shared form skin, widget, Convex, and auth stay untouched.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Vitest 5, `react-dom/server` `renderToStaticMarkup`. Playwright only if a local `next dev` boots without production keys.

## Global Constraints

- White ground, ink `#171717`, quiet text `#525252` or darker, Geist Sans via the existing `--font-geist-sans` variable.
- No airmail envelope. No review banner on the real page.
- Exactly one `Create your page` link and one `Sign in` link. Both `href="/dashboard"`. Create is filled. Sign in is not.
- Specimen caption is `Example`. Letter body is the 189-character Adeyemi sentence. Counter is `189/500`. Reply requested is `Yes`. Selected subject is `Data request`.
- No `form`, `input`, `textarea`, `select`, `button`, or `contenteditable` in the specimen. No `fetch`, `sendUrl`, `configUrl`, or `<shortmail-widget>` on `/`.
- Do not edit `formSkin.ts`, `layout.tsx`, `shortmail-widget.ts`, Convex, auth, or `/send/[vanity]`.
- Do not deploy, merge, or change DNS or production config.
- Tests must not send mail or complete signup.

---

### Task 1: Specimen

**Files:**
- Create: `app/src/components/LetterSpecimen.tsx`
- Test: `app/src/components/LetterSpecimen.test.tsx`
- Create: `app/vitest.config.ts`
- Modify: `app/package.json` scripts

**Interfaces:**
- Produces: `export const LETTER_BODY: string` and `export function LetterSpecimen(): JSX.Element`

- [x] **Step 1: Write the failing test**

`LETTER_BODY` is exactly:

`Dr. Adeyemi, I assigned your 2023 heat-mortality paper in my methods seminar. Two students want the ward-level counts behind Figure 3. Can you share them, or tell me who can, before Friday?`

Assert `.length === 189`. Render with `renderToStaticMarkup`. Assert the caption, name, role, four headings, sender, `189/500`, `Reply requested: Yes`, and that `Data request` is the only element with `data-selected="true"`. Assert the markup has no `form`, `input`, `textarea`, `select`, `button`, or `shortmail-widget`. Spy on `global.fetch` and assert it was not called.

- [x] **Step 2: Run the test and confirm it fails because the module is missing**

Run: `cd app && npx vitest run src/components/LetterSpecimen.test.tsx`

- [x] **Step 3: Implement `LetterSpecimen`**

Server component. No `"use client"`. No imports from `widget/`. Export `LETTER_BODY`. Render the counter from `LETTER_BODY.length`.

- [x] **Step 4: Re-run the test and confirm it passes**

- [x] **Step 5: Commit**

### Task 2: Homepage

**Files:**
- Modify: `app/src/app/page.tsx`
- Delete: `app/src/components/LandingLetter.tsx`
- Test: `app/src/app/landing.source.test.ts`

**Interfaces:**
- Consumes: `LetterSpecimen`

- [x] **Step 1: Write the failing source test**

Read `page.tsx` and the rendered markup of the default export. Assert one anchor named `Create your page`, one named `Sign in`, both `href="/dashboard"`. Assert the privacy paragraph and the FAQ sentence. Assert no import of `LandingLetter`, `sendUrl`, `configUrl`, or `shortmail-widget`. Assert `LandingLetter.tsx` is absent. Assert `shortmail-widget.ts` still contains `/api/send/`. Assert `git diff main -- app/src/widget/formSkin.ts app/src/app/layout.tsx app/src/widget/shortmail-widget.ts` is empty.

- [x] **Step 2: Run it and confirm failure on the current form page**

- [x] **Step 3: Replace `page.tsx` and delete `LandingLetter.tsx`**

Metadata title `ShortMail`, description `One link for short letters. 500 characters, delivered as email.` Root uses `fontFamily: var(--font-geist-sans), sans-serif`. Links use `min-h-11` (44px) and `focus-visible:outline-2`. Create is `bg-[#171717] text-white`. Sign in is unfilled `text-[#171717]`.

- [x] **Step 4: Re-run landing tests and `npx vitest run convex/lib/sendRequest.test.ts`**

- [x] **Step 5: Commit**

### Task 3: Check the running page

- [x] **Step 1: Lint, typecheck, and build**

`npm run lint`, `npx tsc --noEmit`, `npm run build`. Report pre-existing failures separately from new ones.

- [x] **Step 2: Screenshot local `/` at 1440×900 full, 390×844 fold, and 390 full**

Dummy local env only. Fail the check if the page requests `/api/send`, `/api/embed`, `/api/collect`, or `api.resend.com`. Confirm the Create link bottom is inside 844 and 900, and that there is no horizontal overflow at 320, 390, and 1440.

- [x] **Step 3: Commit screenshots only if they live outside the app. Do not commit production env.**

## Self-review

- Spec copy, privacy paragraph, free limits, static specimen, and untouched send path each have a task.
- No placeholder steps.
- `LETTER_BODY` and `LetterSpecimen` names match across tasks.
