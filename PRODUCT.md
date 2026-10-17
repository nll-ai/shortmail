# ShortMail — Product

## Product

ShortMail receives fewer, shorter, better emails. A person publishes a short
contact page (their "send page"); visitors write them a **max-500-character
message** with one click — no email app, no forms that demand a novel. The
owner receives it as clean email. Inspired by Dan Ariely's ShortWhale.

Messages are **never stored**: fire-and-forget delivery via email. Privacy is
a design property, not a feature.

## Users

- **Site owners** (the paying product's users): busy professionals and
  academics/researchers who want a low-friction, dignified contact channel —
  they publish a page, signal what they want to be contacted about (subject
  headings), and stay in control.
- **Visitors**: anyone who wants to reach the owner — colleagues, students,
  event organizers, strangers with a short, genuine ask.

## Feel (confirmed by Eric, 2026-10-17)

All three, unified: **calm and unhurried** ("my message will be read"),
**professional and crisp** (serious, competent), **warm and approachable**
(human, not corporate). The unifier: respect for attention on both sides —
the visitor's time writing it and the owner's time reading it.

## Tiers

- Free: send page, 5 subject headings, 3 FAQs.
- Premium: analytics (views/sends/subjects/reply-ratio), theming (presets +
  custom CSS), embeddable widget (web component, no iframe).

## Constraints

- Fast + minimal: no heavy assets.
- No established brand visual family (Nonlinear Labs has none) — open.
- One account = one email (no aliases, no merging).
- License: BUSL-1.1 (source-available, no commercial use).

## Platform

Web. Next.js 16 (App Router) + Convex + WorkOS AuthKit + Resend. Deployed
Vercel (prod: shortmail-gamma.vercel.app; cutover target:
shortmail.nonlinearlabs.ai).

## Open decisions

- Commercial licensing contact details (currently eric.ma@nonlinearlabs.ai).
- Final production domain (post-cutover).
