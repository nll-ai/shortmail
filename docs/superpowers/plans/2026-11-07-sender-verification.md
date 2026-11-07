# Sender verification implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. The design in `docs/superpowers/specs/2026-11-07-sender-verification-design.md` is already approved.

**Goal:** Require inbox possession before any letter is delivered, and remember that proof per browser and site for 30 days.

**Architecture:** Pure rules live in `app/convex/lib/senderProof.ts`. Convex stores hashes and sends the confirmation through the existing Resend action. The widget keeps secrets in the page origin's storage and will not send the letter until the visitor pastes the code and then presses Send.

**Tech Stack:** Convex HTTP actions, Resend, the existing widget, Vitest.

## Global Constraints

- Do not store the letter body for verification.
- Do not create visitor WorkOS users.
- Do not treat a bare verified-address flag as send permission.
- No state-changing GET. Token only in the URL fragment.
- No real Resend call in tests.
- Do not edit `formSkin.ts` or owner auth beyond allowing `/verify` without a login.
- Rebuild `widget.js` only with `https://hallowed-leopard-387.convex.cloud`.

### Task 1: Pure rules and tests

Files: `app/convex/lib/senderProof.ts`, `app/convex/lib/senderProof.test.ts`, `app/src/widget/senderSession.ts`, `app/src/widget/senderSession.test.ts`.

Cover token hashing, fragment links, confirm replay and mismatch, session expiry, address mismatch, quotas, and two origins that cannot see each other's secrets.

### Task 2: Convex, widget, verify page, copy

Wire start, poll, and confirm. Gate `submitSend`. Update the widget, `/verify`, landing privacy copy, embed docs, and the unauthenticated path list.

### Task 3: Widget bundle and browser checks

Rebuild `public/widget.js` with the production Convex site URL. Run unit tests, typecheck, lint, and build. Exercise the widget against a local mock, not Resend.
