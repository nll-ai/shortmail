# ShortMail Migration Plan v2 — FastAPI/Modal → Next.js/Vercel + Convex (+ Cloudflare test domain)

*(v2 — applied both critics' findings: security C1–C6, simplicity 1–11; see §6 for the resolved questions. Branch: `ericmjl/vercel-convex-migration` (exists, clean). Repo: `nll-ai/shortmail` (private).)*
Sources: research reports `research/platform.md` (§refs below), `research/embed-and-dns.md` (§refs below); the announced `research/codebase.md` was **missing** — all codebase facts below were verified directly against `shortmail/app/main.py` (1055 lines), `shortmail/models/application.py`, `shortmail/utils.py`, `.env`, `.github/workflows/deploy-modal.yaml`, `deployments/app_deploy.py` on the branch.

**Hard stop boundary**: TEST deployment only. `shortmail.nonlinearlabs.ai` keeps pointing at Modal (CF-proxied record untouched). No `modal` commands. No Python file edits. No production DNS cutover (appendix runbook only, execution is Eric's call).

---

## 1. Problem statement

ShortMail today is a FastAPI + Jinja2 + SQLAlchemy(SQLite) app on Modal, with WorkOS AuthKit login and Resend email. Eric wants the app re-platformed onto **Vercel (Next.js) + Convex**, fronted eventually by `shortmail.nonlinearlabs.ai` on Cloudflare — without taking Modal down — and then three premium features built on the new stack: **(a) analytics, (b) theming (presets + custom CSS), (c) iframe-free embedding**. Everything must self-verify against test URLs (`*.vercel.app`, plus `shortmail-test.nonlinearlabs.ai` the moment Eric adds its DNS record — the record block is pre-written). Convex must ship per-PR preview deployments just like Vercel previews.

## 2. Requirements

### 2.1 Example cases that MUST work (acceptance cases)

| # | Case |
|---|------|
| E1 | Visitor opens `/send/{vanity_name}` on the **test** deployment, submits ≤500-char message with a subject heading and RN/NRN tag → recipient receives email from `shortmail@mail.nonlinearlabs.ai`, reply-to = sender. Message is NOT stored (parity: fire-and-forget). |
| E2 | Logged-in user on dashboard edits subject headings (free ≤5) and FAQs (free ≤3, markdown answers); 6th heading / 4th FAQ is refused server-side for free users. |
| E3 | Premium user (existing `isPaid`, toggled by admin) renames their `vanity_name` (parity: paid-only today). |
| E4 | Super admin opens `/admin/users`, toggles a user's `isPaid`, sets another user's `adminRole` (only `super_admin` can do this), deletes a user. |
| E5 | Premium user opens theming settings, picks a preset, saves custom CSS → hosted `/send/{vanity}` page AND embedded widget restyle accordingly. |
| E6 | Premium user pastes `<script src="https://<host>/widget.js" defer></script>` + `<shortmail-widget vanity="demo"></shortmail-widget>` (or `ShortmailWidget.mount(el, {vanity})`) into any static HTML page → form renders **without an iframe**, submits work, beacons record analytics. Optional: owner sets `embedAllowedOrigins` on their account to restrict which sites may mount their form. |
| E7 | Premium user opens `/analytics` → sees real form views + sends for their own page (30-day trend, popular subjects, RN ratio). |
| E8 | A PR gets a Vercel preview URL **and** its own fresh Convex preview backend (seeded demo user), i.e. sign-in + send work on the preview without touching prod data. |
| E9 | *(contingent on Eric's one-record handoff)* `https://shortmail-test.nonlinearlabs.ai` serves the new app from Vercel (grey-cloud CNAME → `cname.vercel-dns.com`) while `shortmail.nonlinearlabs.ai` still serves Modal. Primary verification path is the Vercel project domain (`*.vercel.app`); this case is executed the moment the record exists. |

### 2.2 What MUST be refused

| # | Refusal |
|---|---------|
| R1 | Non-premium user cannot save theme settings, cannot use embedding (config endpoint refuses + dashboard gated), and `/analytics` shows the upsell card — enforcement in **Convex mutations/queries**, not client UI. |
| R2 | Unsanitized custom CSS never reaches a browser: save-time parse-and-allowlist strips `url()`, `@import`, `@font-face`, `image-set()`, `expression()`, `behavior`, rejects unbalanced braces/quotes, caps ~16KB, strips comments. Custom CSS is only ever applied **inside the widget's shadow root** (never injected into the host page document). |
| R3 | A signed-in owner cannot read another owner's analytics or edit another owner's headings/FAQs/theme — every Convex function scopes by `ctx.auth.getUserIdentity()` → app `users` row. |
| R4 | Anonymous POSTs to `/api/send/{vanity}` over 500 chars, with disposable sender domains, or exceeding rate limits are rejected. Rate limiting is **wired from day one** (the old app's `RateLimiter` was instantiated but never called — see `shortmail/app/main.py:28,53`). |
| R5 | The collector (`/api/collect/{vanity}`) accepts only size-capped `text/plain` JSON bodies, rate-limits per IP (~30/min, advisory) with a per-vanity daily event cap (enforced), and **always returns 204** (never 404 — no existence enumeration); stores no PII, drops query strings. |
| R6 | Nothing in this migration mutates DNS for `shortmail.nonlinearlabs.ai`, runs any `modal` command, or edits files under `shortmail/`, `deployments/`, `Dockerfile`, `pyproject.toml`, `.github/workflows/deploy-modal.yaml`. |

## 3. Design

### 3.1 Monorepo layout

```
repo root (Python app untouched)
├── app/                          # ← Vercel "Root Directory" = app
│   ├── package.json              # next, react, convex, @workos-inc/authkit-nextjs, @convex-dev/workos, postcss
│   ├── next.config.ts            # headers(): /widget.js → ACAO:* + cache
│   ├── convex/                   # Convex functions (codegen → convex/_generated)
│   │   ├── schema.ts  auth.config.ts  http.ts
│   │   ├── users.ts  forms.ts  public.ts  admin.ts  emails.ts
│   │   ├── analytics.ts  collector.ts  theming.ts
│   │   ├── lib/cssSanitize.ts  lib/rateLimit.ts  lib/identity.ts
│   │   └── devSeed.ts            # --preview-run target
│   ├── src/app/                  # App Router (src-dir avoids app/app/app)
│   │   ├── page.tsx              # landing (parity: marketing + Sign In)
│   │   ├── callback/route.ts     # handleAuth()
│   │   ├── dashboard/page.tsx    # headings/FAQs/vanity/display/links to premium tools
│   │   ├── dashboard/theming/page.tsx  dashboard/embed/page.tsx
│   │   ├── analytics/page.tsx    # SVG chart, no chart lib
│   │   ├── admin/page.tsx  admin/users/page.tsx
│   │   ├── send/[vanityName]/page.tsx
│   │   └── embed-docs/page.tsx   # premium: copy-paste snippet + docs
│   ├── src/components/ConvexClientProvider.tsx
│   ├── src/widget/shortmail-widget.ts   # source for public/widget.js (esbuild, prebuild)
│   ├── public/widget.js          # built artifact, single <script src> loader + <shortmail-widget>
│   ├── middleware.ts             # authkitMiddleware
│   └── scripts/vercel-build.sh   # build wrapper (§3.8)
├── scripts/setup-workos-uris.sh  # one-shot WorkOS redirect-URI registration (P2)
└── docs/vercel-migration.md      # env inventory + cutover runbook (P7)
```

Python CI (`.github/workflows/deploy-modal.yaml`) untouched; new `.github/workflows/app-ci.yml` for `app/` (§3.9).

### 3.2 Convex schema (`app/convex/schema.ts`)

```ts
users:          { email: string, workosUserId: string, vanityName: string,
                  displayName?: string, isPaid: boolean,
                  embedAllowedOrigins?: string[], /* optional owner-set embed restriction */
                  adminRole?: "super_admin"|"admin"|"moderator", createdAt: number }
                // indexes: by_email (unique), by_vanity (unique), by_workos (unique)
subjectHeadings:{ ownerId: id<"users">, heading: string }            // by_owner
faqs:           { ownerId: id<"users">, question: string, answer: string /*markdown*/ } // by_owner
events:         { ownerId: id<"users">, type: "form_view"|"send_success",
                  day: string /*YYYY-MM-DD*/, ts: number, subject?: string,
                  path?: string, ref?: string }
                // indexes: by_owner_day [ownerId, day] — analytics reads are on-the-fly scans of ≤31 day ranges
rateLimits:     { key: string /* "send:{ip}" | "collect:{ip}" | "cap:{vanity}:{YYYY-MM-DD}" */,
                  windowStart: number, count: number }               // by_key
```

NOTES (v2): no `embedKeys` table — embed identity is the owner's public `vanityName` (a generated key was "public-by-design" anyway; see §3.5). No `dailyStats`/cron rollup — analytics reads count `events` directly via the `by_owner_day` index (handful of users; add rollup only if queries get slow). `embedAllowedOrigins` lives on the owner row (optional, default open embedding).

Legacy Python fields deliberately **not** carried: `login_token`, `token_expiry`, deprecated `is_admin` (`application.py` marks them deprecated). `messages` table: none, by design (send is fire-and-forget, R6-parity). Migration of SQLite data: see Open Question Q1 (default: fresh start on test).

### 3.3 Auth wiring (WorkOS AuthKit + Convex — platform.md §3)

- `middleware.ts`: `export default authkitMiddleware({ middlewareAuth: { enabled: true } })` + standard matcher (excludes `/api/*`, `/_next`, static; public pages don't require auth).
- `src/app/callback/route.ts`: `export const GET = handleAuth()`.
- `src/components/ConvexClientProvider.tsx`: `AuthKitProvider` + `ConvexProviderWithAuth` bridging `useAuthFromAuthKit` → `fetchAccessToken` (sample: docs.convex.dev/auth/authkit/add-to-app).
- `convex/auth.config.ts`: two `customJwt` providers — issuer `https://api.workos.com/` and `https://api.workos.com/user_management/${WORKOS_CLIENT_ID}`, RS256, jwks `https://api.workos.com/sso/jwks/${clientId}`. `WORKOS_CLIENT_ID` set as **Convex dashboard env var on every deployment** (dev/prod/each preview backend — handled by build wrapper §3.8). Gotchas honored: set JWT `audience` = clientId in WorkOS dashboard (Convex requires `aud`); run `npx convex dev`/`deploy` after any `auth.config.ts` edit.
- Identity → app user: `convex/lib/identity.ts` `getOrCreateCurrentUser(ctx)`: reads `ctx.auth.getUserIdentity()` (subject = WorkOS user id, email + `emailVerified` from token claims), upserts `users` keyed by `workosUserId` (retry-on-conflict once for the unique-index race). On create, if `email === process.env.SUPER_ADMIN_EMAIL` **and `emailVerified === true`** → `adminRole: "super_admin"` (bootstrap). Repair path: `convex/admin.ts` internalMutation `claimSuperAdmin` (env-gated on `SUPER_ADMIN_EMAIL`) so a fresh backend where the env var landed late can self-heal (parity with the old app's startup promotion, `main.py:247-254`).
- WorkOS redirect URIs: **API-automated** — `scripts/setup-workos-uris.sh` (runs once from a laptop holding `WORKOS_API_KEY`) POSTs to `https://api.workos.com/user_management/redirect_uris`: `http://localhost:3000/callback`, `https://shortmail-test.nonlinearlabs.ai/callback`, `https://shortmail.nonlinearlabs.ai/callback` (for later), and preview wildcards `https://shortmail*-eric-mas-projects-a230afd1.vercel.app/callback` (the account already uses wildcard URIs of this exact shape for other projects; the redirect-URI API was verified writable 2026-10-16). One dashboard step remains manual: AuthKit JWT **audience** = clientId (Convex requires `aud`).
- Free limits + premium flag: `FREE_HEADING_LIMIT = 5`, `FREE_FAQ_LIMIT = 3` (parity with `main.py:354–402`); premium = existing `isPaid` field only (no billing).

### 3.4 Send + email wiring (v2: all public APIs are Convex httpActions with explicit CORS)

- Public endpoints live in `convex/http.ts` as **httpActions on the Convex deployment URL** (`*.convex.site`), each wired with `preflight` + `Access-Control-Allow-Origin: *` (they are called cross-origin by the embedded widget and by the hosted page):
  - `GET /api/embed/{vanity}/config` — public config: displayName, vanityName, headings[], faqs[], theme preset+sanitized CSS, `isPaid` (drives gating UI). If the owner has set `embedAllowedOrigins`, requests whose `Origin`/`Referer` does not match get a 403 body (`embed_not_allowed`) — the widget renders a visible "embed not allowed on this site" state instead of the form.
  - `POST /api/send/{vanity}` — the one send path (hosted page and widget both use it).
  - `POST /api/collect/{vanity}` — analytics beacons; **always 204**, even for unknown vanity (no enumeration), size-capped 32KB, `text/plain` only.
  The widget bakes the absolute base URL (`NEXT_PUBLIC_CONVEX_URL`) into `public/widget.js` at build time (public, not secret). Hosted `/send/{vanityName}` pages read it server-side from env.
- `submitSend` internal flow (called by the httpAction): validate user by vanity (unknown → 404), ≤500 chars, disposable-domain check (short hardcoded list — the old `data/disposable_emails.txt` never existed in the repo; `is_disposable_email` was a live no-op), **per-vanity daily send cap enforced** (`cap:{vanity}:{date}` row, default 200/day) + per-IP window as advisory (see §7), honeypot field, builds subject `[RN]/[NRN] <heading|custom>` and body `From: <name> <\<email\>>\n\n<message>` (exact parity with `main.py:510-577`), then `ctx.scheduler.runAfter(0, internal.emails.sendShortmailEmail, {...})`. No `events` row is written here — `send_success` is recorded by the email action after a Resend 2xx (§3.7).
- `convex/emails.ts` `internal` action `sendShortmailEmail`: `fetch("https://api.resend.com/emails", {Authorization: Bearer RESEND_API_KEY})`, body `{from: "shortmail@mail.nonlinearlabs.ai", to, reply_to, subject, html, text}` (**html+text parity** with `utils.py:60-67`). `Idempotency-Key: <message-uuid>`. On 2xx the action writes the `send_success` event (so analytics count real emails, not optimistic submits); failures land in Convex logs; the result page stays optimistic — documented behavioral delta.
- Pass criteria note (environment fact 2026-10-16): `mail.nonlinearlabs.ai` is in `failed` verification state on the Resend account (pre-existing; affects the Modal app identically). P1 verification therefore asserts **Resend API 200 + message id**, with inbox receipt deferred until the domain is re-verified (DNS TXT records, Eric's Cloudflare dashboard).

### 3.5 Widget architecture (embed-and-dns.md §B, §D)

- **One rendering path**: the widget custom element **is** the contact form. The hosted `/send/{vanityName}` page server-renders a shell (title, meta) and mounts `<shortmail-widget vanity="...">`. Embed pages do the same via `<script src=".../widget.js" defer></script>` + `<shortmail-widget vanity="demo">`. Config comes from the **element's own attribute first** (`vanity`), falling back to the script tag's `data-vanity` — prevents the two-widgets-two-scripts clobber reading one key for both.
- `src/widget/shortmail-widget.ts` (vanilla TS, no framework) → esbuild IIFE → `public/widget.js` in `prebuild` (absolute Convex base inlined via `define`). Loader: double-`customElements.define` guard; `window.ShortmailWidget.mount(el, {vanity})`; `_upgradeProperty` for pre-upgrade props.
- Shadow root: `attachShadow({mode:"open"})` in constructor (open keeps debugging possible; documented trust model: **the host page can read what visitors type into an embedded widget — embed only on sites you trust**, stated in /embed-docs); `:host{display:block}` + `:host([hidden]){display:none}` + `:host{all:initial}` reset; `adoptedStyleSheets = [baseSheet, presetSheet, ownerSheet]` (sheets constructed once per module via `replaceSync`).
- Data flow: on connect, widget fetches `GET {CONVEX_URL}/api/embed/{vanity}/config` → renders; submit → `POST {CONVEX_URL}/api/send/{vanity}`; beacons → `navigator.sendBeacon("{CONVEX_URL}/api/collect/{vanity}", JSON.stringify(payload))` with **text/plain** (no-cors, no preflight), fallback `fetch(..., {keepalive:true, headers:{"content-type":"text/plain"}})`, flush on `visibilitychange→hidden`; collector always 204.
- `widget.js` served by Vercel with `Access-Control-Allow-Origin: *` + `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=600` (short max-age beats content-hash plumbing at our scale; hashed filenames if Eric wants strict immutability later). `<script src>` needs no CORS; header added anyway for direct-fetches.
- `::part()` on stable chunks (`.form`, `.input`, `.button`, `.heading`, `.faq`) = outer-page styling API; CSS custom properties (`--sm-*`) cross the shadow boundary = theming channel.

### 3.6 Theming token architecture

- Presets: `"default" | "midnight" | "paper" | "contrast"` — each a `Record<string,string>` of CSS custom properties (`--sm-accent`, `--sm-bg`, `--sm-text`, `--sm-muted`, `--sm-border`, `--sm-radius`, `--sm-font`) defined in `src/widget/presets.ts`, compiled into the widget AND exposed server-side for the hosted page shell.
- Custom CSS: saved via premium-gated mutation `theming.saveTheme` → `convex/lib/cssSanitize.ts` — **postcss** parse, then per declaration value: strip comments → **decode CSS escape sequences** (`/\\([0-9a-fA-F]{1,6}\s?|.)/g` — `\75rl(` must not survive as a hidden `url(`) → lowercase → reject if it contains `url(`, `image-set(`, `attr(`; walk **all** nested rules recursively (`root.walkDecls` covers `@media`/`@supports`/`@keyframes` nesting); drop at-rules `@import/@font-face/@charset/@namespace`; drop `behavior`/`expression`; reject on unbalanced braces/quotes; cap 16KB; store re-serialized string. Applied only as `ownerSheet` inside shadow roots (R2), and to the theming page's live draft preview via the same pure-TS function. Vitest vectors include: `\75rl(https://evil)`, `URL(https://evil)`, `ur/**/l(https://evil)` (post-comment-strip), url hidden inside a custom-property value and inside nested `@media`/`@keyframes`, unbalanced braces, 16KB overflow (vectors from embed-and-dns.md §C + security critique C2).
- Dashboard page `/dashboard/theming` (premium): preset picker, live preview (widget mounted with draft theme), CSS textarea with save-time sanitization notice.

### 3.7 Analytics

- Collection: widget + hosted page beacon `form_view` on mount; `send_success` recorded **inside the email action after a Resend 2xx** (analytics count real emails, not optimistic submits; no message content, no PII).
- Reads are **on-the-fly**: `/analytics` queries scan `events` via the `by_owner_day` index over the requested ≤31 day ranges and aggregate in the query (totals, per-day bars, top subjects, RN ratio). No `dailyStats`, no `crons.ts`, no `convex.config.ts`, no `@convex-dev/aggregate` in v1 — revisit only if/when scans get slow. A per-vanity daily event cap (collector, §3.4) bounds table growth.
- Dashboard `/analytics` (premium; free users see upsell card — parity with the current hardcoded stub at `main.py:673–701`): 30-day SVG bar chart (views vs sends), totals, top subjects, RN ratio. All queries scoped via identity (R3).

### 3.8 Preview-deploy wiring (linchpin — platform.md §2)

- Vercel project `shortmail` (team `eric-mas-projects-a230afd1`): **Root Directory `app`**; Framework Next.js; Build Command override:
  `bash scripts/vercel-build.sh`.
- `scripts/vercel-build.sh` (idempotent, runs in `app/`):
  1. `npx convex env set WORKOS_CLIENT_ID "$WORKOS_CLIENT_ID"` (fresh preview backends need it; harmless on prod re-runs; **no output-swallowing** — an auth failure here must fail the build loudly),
  2. `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` (+ `--preview-run 'devSeed:seedDemo'` when preview key detected via `CONVEX_DEPLOY_KEY=preview:*` prefix check).
  - Verify at execution: `npx convex deploy --help | grep -A1 cmd-url-env-var-name`. Fallback if flag renamed: wrapper exports `NEXT_PUBLIC_CONVEX_URL="$CONVEX_URL"` after a plain `npx convex deploy` push step.
- Vercel env vars: `CONVEX_DEPLOY_KEY` **prod** key (`prod:…`) → Production only; `CONVEX_DEPLOY_KEY` **preview** key (`preview:…`) → Preview (+Development). This is the verified dual-key mechanism: preview keys create a fresh per-branch Convex deployment and auto-cleanup after ~5 days. Also `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (≥32 chars, distinct per env), optional `WORKOS_REDIRECT_URI`.
- Convex env vars (set once per backend via dashboard or wrapper): `WORKOS_CLIENT_ID`, `RESEND_API_KEY`, `SUPER_ADMIN_EMAIL`.
- `devSeed.ts` `seedDemo` (internalMutation, no-op if exists): demo user `vanityName:"demo"` with 2 headings, 2 FAQs, `isPaid:false`, + a `demo-premium` user with `isPaid:true` — so every fresh preview backend is testable without sign-in for the public path.
- Preview auth: per-PR `*.vercel.app` hostnames are pre-allow-listed via the wildcard redirect URIs registered by `scripts/setup-workos-uris.sh` (§3.3) — no per-PR dashboard visits.

### 3.9 CI (`.github/workflows/app-ci.yml`)

- Triggers: `push` (main) + `pull_request`, `paths: ["app/**", ".github/workflows/app-ci.yml"]`.
- Job `app`: `setup-node 24` → `npm ci` (in `app/`) → `npx convex codegen` (verify subcommand exists at execution; fallback: run `next build` with placeholder `NEXT_PUBLIC_CONVEX_URL` only if codegen alone can't generate `_generated` without a deployment) → `tsc --noEmit` → `eslint` → `npm run test` (vitest for `cssSanitize` + widget unit tests).
- Job `python`: keep pytest green, mirroring existing tooling (**pixi**, not uv — `pixi.lock`/`pyproject.toml` are the source of truth) — Python is untouched, this just proves we didn't break it. `deploy-modal.yaml` untouched.
- No secrets in CI (no deploy from CI; Vercel/Convex deploys happen via their Git integrations/wrapper).

### 3.10 DNS / test-domain wiring + cutover (v2: handoff primary — no Cloudflare token exists on this machine)

- **Primary path (handoff)**: `docs/vercel-migration.md` carries a ready-to-paste block for Eric — (a) Cloudflare dashboard: add record `CNAME shortmail-test → cname.vercel-dns.com`, proxy status **DNS-only (grey cloud)**, TTL auto; or (b) the equivalent authenticated `curl` if Eric prefers minting a `DNS Write` token. After the record exists: `vercel domains add shortmail-test.nonlinearlabs.ai` (attach to project; cert auto-issues), then evidence: `dig +short shortmail-test.nonlinearlabs.ai CNAME` → `cname.vercel-dns.com.` and `curl -sI https://shortmail-test.nonlinearlabs.ai` → 200.
- **Production-untouched evidence (no token needed)**: `dig +short shortmail.nonlinearlabs.ai` still returns Cloudflare anycast IPs (104.21.x/172.67.x) and `curl -s https://shortmail.nonlinearlabs.ai` still serves the FastAPI app (200, HTML, no Next.js markers) — captured before and after all work as R6 evidence.
- **Cutover runbook (appendix of `docs/vercel-migration.md`; NOT executed)**: add `shortmail.nonlinearlabs.ai` in Vercel → `PATCH` the CF record content to `cname.vercel-dns.com` (stay orange-cloud only with SSL Full(strict) + unblocked `/.well-known/acme-challenge/*`, else grey-cloud per Vercel recommendation) → remove `custom_domains` from `deployments/app_deploy.py` + `modal deploy` (Eric's call) → rollback = revert PATCH (TTL ~300s).

## 4. Alternatives considered (why lost)

| Alternative | Why lost |
|---|---|
| **iframe embed** | Explicitly excluded by the operator ask ("should not use iframe"). Also: cookie/positioning pain, no styling access, heavy. Shadow-DOM widget chosen instead. |
| **Light-DOM embed** (inject markup into host page) | Style bleeds both directions; host CSS breaks the form; host styles leak in via inheritance. Shadow root + `all:initial` + `adoptedStyleSheets` solves isolation (embed-and-dns.md §B.3). |
| **`@convex-dev/auth` magic links** | Drops existing WorkOS accounts/SSO and diverges from the current AuthKit setup; official Convex×AuthKit integration exists (platform.md §3.7). |
| **Vercel Postgres/Neon instead of Convex** | Operator explicitly specified Convex. Also loses per-branch preview backends. |
| **Proxying through Cloudflare orange-cloud for the test domain** | Vercel recommends DNS-only (grey-cloud); proxying needs Full(strict) + ACME-path carve-outs and hides traffic from Vercel Firewall (embed-and-dns.md §A.1–2). Grey chosen for `shortmail-test`; prod cutover keeps the choice documented. |
| **Per-request widget config injection via route handler** (`/api/widget`) | Static hashed-ish file is simpler and cache-friendly; config comes from `/api/embed/{key}/config` anyway. Route handler kept as fallback if per-request script injection is ever needed (platform.md §5). |
| **Random embed keys (generate/revoke UI)** | The key is a public capability — it authorizes nothing a stranger can't already do against the public `/send/{vanity}` page. Vanity-derived paths + owner-set `embedAllowedOrigins` cover the same ground with zero ceremony (v2 §3.5). |
| **Regex CSS sanitization** | Known-bypassable (encoding, nesting). Parse-and-allowlist with a real parser (postcss) + escape-decoding chosen. |
| **Chart library for analytics** (recharts etc.) | Dependency weight for one 30-day bar chart; hand-rolled SVG suffices. |

## 5. Phased implementation plan

Each phase ends shippable + verifiable on its own. Issues: **Step 0** posts the parent issue + one child issue per phase to `nll-ai/shortmail` via `gh` (account `ericmjl`, correct outside `~/ormoni`), each child body referencing this plan file's section; executor ticks through them.

**P0 — Scaffold + Convex schema + auth** (`app/` created; nothing deployed)
Files: `app/**` scaffold (`create-next-app@latest app --ts --tailwind --eslint --app --src-dir` + `npm i convex @workos-inc/authkit-nextjs @convex-dev/workos postcss`), `convex/schema.ts`, `convex/auth.config.ts`, `convex/lib/identity.ts`, `src/components/ConvexClientProvider.tsx`, `middleware.ts`, `src/app/callback/route.ts`, `app/.env.example`, placeholder landing.
Verify (local): `npx convex dev` creates dev deployment → set `WORKOS_CLIENT_ID` via `npx convex env set`; `npm run dev` on :3000 → sign-in round-trip lands on a page showing the authenticated email; `users` row appears in Convex dashboard; `super_admin` auto-assigned when signing in as `SUPER_ADMIN_EMAIL`. WorkOS dashboard: add `http://localhost:3000/callback` + JWT audience = clientId.

**P1 — Core feature parity** (landing, send, dashboard, admin, email)
Files: `convex/public.ts`, `convex/forms.ts`, `convex/users.ts`, `convex/admin.ts`, `convex/emails.ts`, `convex/lib/{rateLimit.ts,disposableDomains.ts (short hardcoded list)}`, `convex/http.ts` (`/api/send/{vanity}` POST + `/api/embed/{vanity}/config` GET + `/api/collect/{vanity}` POST, all with `preflight` CORS), pages `page.tsx`, `send/[vanityName]/page.tsx`, `dashboard/page.tsx`, `admin/page.tsx`, `admin/users/page.tsx`; drop the broken `/faq/{email}` route (references a missing template — dead code, not parity) and all legacy cruft (login_token, set_admin, `/upgrade`+`/admin/dashboard` dead links).
Verify (local `npx convex dev` + `npm run dev`): `curl -X POST https://<dev-backend>.convex.site/api/send/demo -d 'sender_name=T&sender_email=t@example.com&reply_needed=yes&subject=Hello&message=hi'` → submit OK; **pass = Resend API 200 + message id in `npx convex logs`** (inbox receipt deferred — the sending domain is in `failed` verification on Resend, a pre-existing condition affecting the Modal app identically; expected subject `[RN] Hello`); 501-char message → 400; 6th heading as free user → mutation throws (UI disables too); admin toggles `isPaid`; non-admin sees refusal; `pytest` untouched and green.

**P2 — Deploy + preview wiring (Vercel project + per-PR Convex backends)**
Files: `app/scripts/vercel-build.sh`, `convex/devSeed.ts`, `scripts/setup-workos-uris.sh`, `vercel.json` (if needed for root-dir/build settings), docs env inventory.
Verify: run `scripts/setup-workos-uris.sh` once (registers localhost + test + prod + preview-wildcard redirect URIs via the WorkOS API); `vercel link` + set env vars per §3.8; `npx convex deploy --help | grep cmd-url-env-var-name` (or apply fallback); open draft PR → Vercel preview builds with `CONVEX_DEPLOY_KEY=preview:*` → preview URL serves landing; `curl https://<preview-convex-site>/api/embed/demo/config` returns seeded demo config; **sign-in round-trip works on the preview** (wildcard URI pre-registered); confirm preview Convex dashboard shows a fresh backend seeded with `demo` + `demo-premium`; confirm **prod** Convex deployment untouched.

**P3 — Test deployment + end-to-end self-verify**
Files: `docs/vercel-migration.md` (started; includes the DNS handoff block + cutover appendix).
Verify: merge the branch → Vercel production deploy of the new `shortmail` project → seed prod backend once (`npx convex run devSeed:seedDemo` against the prod deployment); capture R6 evidence: `dig +short shortmail.nonlinearlabs.ai` (unchanged Cloudflare IPs) + `curl -s https://shortmail.nonlinearlabs.ai` (still the FastAPI app — 200, HTML, no Next markers); full E1–E8 pass on the Vercel domain; hand Eric the one-record DNS block for `shortmail-test.nonlinearlabs.ai` (§3.10) and execute E9 the moment it exists (dig → `cname.vercel-dns.com.`, `curl -sI` → 200, full E1–E4 re-run on that host).

**P4 — Analytics**
Files: `convex/analytics.ts` (on-the-fly queries), `convex/collector.ts`, `convex/http.ts` (+`/api/collect/{vanity}`), `src/app/analytics/page.tsx`, beacon helper in widget/host page.
Verify: mount hosted page → `events` row appears; `curl -s -o /dev/null -w '%{http_code}\n' -X POST .../api/collect/demo -H 'content-type: text/plain' -d '{"event":"form_view"}'` → 204; **unknown vanity → also 204** (never 404); 31 rapid POSTs from one IP → subsequent throttled (advisory); per-vanity daily cap → events stop accruing for that vanity after cap (enforced); premium user sees real chart; free user sees upsell; signed-in user B querying A's data gets empty/refused (R3).

**P5 — Theming**
Files: `convex/theming.ts`, `convex/lib/cssSanitize.ts` + vitest suite, `src/widget/presets.ts`, `src/app/dashboard/theming/page.tsx`, widget/host theming application.
Verify: save preset → `/send/...` + widget restyle; save custom CSS with `background:url(https://evil/log)` → stored string contains no `url(` (unit tests for full vector list: `@import`, `@font-face`, `image-set`, unbalanced braces, 16KB overflow); non-premium `saveTheme` → error `PREMIUM_REQUIRED` (R1); preview shows sanitized CSS applying inside shadow root only (host page styles unaffected).

**P6 — Embed widget + loader + docs**
Files: `src/widget/shortmail-widget.ts`, `public/widget.js` (esbuild prebuild), `next.config.ts` headers, `convex/users.ts` (+`setEmbedAllowedOrigins` mutation), `src/app/dashboard/embed/page.tsx`, `src/app/embed-docs/page.tsx`.
Verify: static `test-embed.html` (served from any host) with `<script src="https://<host>/widget.js" defer></script>` + `<shortmail-widget vanity="demo">` → form renders (no iframe in DOM), submit logs a Resend 200 in Convex, beacon recorded; second `<script>` include doesn't throw (define guard); `curl -sI .../widget.js` shows `access-control-allow-origin: *`; widget works on a page with aggressive host CSS (proof of isolation); with the owner's `embedAllowedOrigins` set to a non-matching origin, the config endpoint returns 403 and the widget renders the "embed not allowed" state.

**P7 — Docs, runbook, final gate**
Files: `docs/vercel-migration.md` (env inventory, WorkOS URI list, DNS handoff block, cutover appendix, known deltas: optimistic send result, JS-required hosted page, embed trust model), README section pointing Python readers at the new stack.
Verify: full §8 checklist executed incl. the compact final gate — `requirePremium` present on every premium mutation (already exercised by P4/P5 refusal tests) + identity-derivation audit (every `ownerId` comes from `ctx.auth`, never args) + secrets audit (no `NEXT_PUBLIC_` on `WORKOS_API_KEY`/`RESEND_API_KEY`/`CONVEX_DEPLOY_KEY`; prod/preview deploy keys on disjoint Vercel environments); PRs merged to `ericmjl/vercel-convex-migration`; **STOP — no prod cutover, no Modal changes**; present Eric the test URLs + evidence table.

## 6. Open questions

Resolved during critique (2026-10-16):
- **WorkOS preview redirect URIs** → API-automated via `scripts/setup-workos-uris.sh` (redirect-URI API verified writable; wildcard URIs already proven in this account). One manual dashboard step remains: AuthKit JWT audience = clientId.
- **Cloudflare DNS token** → none exists on this machine and `op` is unavailable: handoff to Eric is the primary path (§3.10); `*.vercel.app` verification does not depend on it.
- **Embed restriction** → no key ceremony; optional owner-set `embedAllowedOrigins` enforced at the config endpoint, default open, trust model disclosed (§3.5, §7).

Remaining (each with recommended default):

- **Q1 — SQLite → Convex data migration?** Default: **no data migration** for the test deployment (fresh Convex; users recreate content; `isPaid` re-toggled via admin). Optional later: one-off Node script reading `data/shortmail.db` → `npx convex run` upserts, run only at cutover if Eric wants continuity.
- **Q4 — Super-admin bootstrap email.** Default: `SUPER_ADMIN_EMAIL` (already in `.env`) set as Convex env var on every backend; first matching **verified-email** login becomes `super_admin`; `claimSuperAdmin` repair mutation covers late env-set. Confirm Eric's WorkOS login email matches.

## 7. Security / failure modes

- **CSS sanitization bypass**: real-parser allowlist (postcss), not regex; strip network-bearing constructs + `expression()`/`behavior`; reject unbalanced braces/quotes; 16KB cap; comments stripped; **defense-in-depth: custom CSS only ever mounts inside a shadow root** — even a missed vector cannot reach the host document. Vitest vectors from embed-and-dns.md §C.
- **Collector abuse/spam**: vanity-in-path, **204-always** (no existence enumeration), 32KB body cap, `text/plain` only, per-vanity **daily event cap enforced** (bounds table growth + poisoning), per-IP fixed-window rate limit (~30/min, advisory — see next bullet), payload schema enforced, no cookies/PII, query strings dropped, DNT honored for page-view beacons.
- **Header-spoofed rate limits**: the public endpoints sit on `*.convex.site`, so `x-forwarded-for` is attacker-controlled for direct requests; per-IP windows are therefore advisory noise control. The enforced limits are per-vanity daily caps (sends: 200/day default; collector events: capped/day) — cheap single-doc upserts in `rateLimits`, one shared helper for send + collector.
- **Send endpoint abuse**: rate limiting wired **day one** — fixes the old app's dead `RateLimiter` (`main.py:53`, never called); per-vanity daily send cap enforced + per-IP advisory; honeypot field; 500-char cap; hardcoded disposable-domain list (the old file never existed — `is_disposable_email` was a live no-op); no message storage limits the blast radius of any spam that slips through.
- **Embed trust model (disclosed)**: embed identity is the owner's public `vanityName`; config/send/collect are public endpoints — a stranger can already hit the hosted `/send/{vanity}` page. What embedding adds: a hostile host page can read what visitors type (open shadow root is inspectable — chosen for debuggability; `mode:"closed"` adds no real security) and can render someone's form on a lookalike site (harvested messages still go to the real owner's inbox). Mitigations: owner-set `embedAllowedOrigins` enforced at the config endpoint (widget refuses to render on non-allowed hosts); trust-model warning in `/embed-docs` ("embed only on sites you trust"); nothing secret client-side (Convex URL + vanity are public).
- **Preview data isolation**: dual `CONVEX_DEPLOY_KEY` scoping (prod key never present in Preview env and vice-versa) + fresh per-branch backends = previews physically cannot touch prod data; seed data is synthetic; preview URLs require no auth for public paths.
- **Session/cookie config**: `WORKOS_COOKIE_PASSWORD` ≥32 chars, distinct per Vercel environment; AuthKit middleware sets secure/SameSite cookies; secrets only in Vercel + Convex env stores, `.env*` gitignored (verify `.gitignore` covers `app/.env.local`); CSP `frame-ancestors 'none'` on `/dashboard*` (nothing there should ever be framed); super-admin bootstrap requires `emailVerified` + `claimSuperAdmin` repair mutation; final-gate secrets audit (no `NEXT_PUBLIC_` on `WORKOS_API_KEY`/`RESEND_API_KEY`/`CONVEX_DEPLOY_KEY`; prod/preview deploy keys on disjoint Vercel environments).
- **Email send failure**: decoupled via scheduler; `Idempotency-Key` prevents dupes on retry; failures visible in Convex dashboard logs; result page optimistic (documented delta). Monitor after P3 by checking one real receipt.
- **Rate-limit DoS on our own checks**: fixed-window rows are upserted single-doc mutations — cheap; collector failures never block rendering (beacons are fire-and-forget).

## 8. Self-verification checklist (executable)

```bash
# P0/P1 (local, convex dev running) — email pass = Resend API 200 + message id in `npx convex logs`
# (sending domain mail.nonlinearlabs.ai is in failed verification — pre-existing; inbox receipt deferred)
cd app && npm run dev & npx convex dev &
curl -s localhost:3000 | grep -i shortmail                        # E-landing
curl -s -X POST https://<dev-backend>.convex.site/api/send/demo --data-urlencode "sender_name=T" \
  --data-urlencode "sender_email=t@example.com" --data-urlencode "reply_needed=yes" \
  --data-urlencode "subject=Hello" --data-urlencode "message=hi"  # → 200; Convex log shows Resend 200 + message id
curl -s -X POST https://<dev-backend>.convex.site/api/send/demo --data-urlencode "sender_name=T" --data-urlencode \
  "sender_email=t@example.com" --data-urlencode "reply_needed=no" --data-urlencode \
  "subject=Hello" --data-urlencode "message={}"                   # → 400

# P2 (preview)
npx convex deploy --help | grep -c cmd-url-env-var-name           # ≥1 (else fallback wired)
bash scripts/setup-workos-uris.sh                                  # registers preview-wildcard + test + prod URIs
gh pr create --draft; sleep 300
curl -s https://<preview-convex-site>/api/embed/demo/config | jq '.vanityName'   # "demo"
# browser: preview sign-in round-trip (wildcard URI pre-registered — no dashboard visit)

# P3 (test deployment + R6 evidence)
dig +short shortmail.nonlinearlabs.ai | sort                       # unchanged Cloudflare IPs (before/after snapshot)
curl -s https://shortmail.nonlinearlabs.ai | head -5               # still the FastAPI app (no Next markers)
curl -sI https://shortmail.vercel.app | head -1                    # HTTP/2 200 from the new stack
# after Eric's one-record handoff (grey-cloud CNAME shortmail-test → cname.vercel-dns.com):
dig +short shortmail-test.nonlinearlabs.ai CNAME                   # cname.vercel-dns.com.
curl -sI https://shortmail-test.nonlinearlabs.ai | head -1         # HTTP/2 200

# P4 (analytics)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<prod-convex-site>/api/collect/demo \
  -H 'content-type: text/plain' -d '{"event":"form_view","path":"/send/demo"}'   # 204
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<prod-convex-site>/api/collect/not-a-user \
  -H 'content-type: text/plain' -d '{"event":"form_view"}'                        # also 204 (no enumeration)
npx convex run analytics:debugDaily                                 # events visible, per-day counts grow
# browser: /analytics as premium → chart; as free → upsell card

# P5 (theming)
cd app && npx vitest run lib/cssSanitize                           # all vectors stripped
# dashboard → save preset+CSS → /send/... restyled; free user save → PREMIUM_REQUIRED

# P6 (embed)
cat /tmp/test-embed.html   # script src=/widget.js + <shortmail-widget vanity="demo">
open /tmp/test-embed.html against the deployed host                   # form renders, submit → Resend 200 logged, beacon row
curl -sI https://<host>/widget.js | grep -i access-control-allow-origin  # *
curl -s https://<prod-convex-site>/api/embed/demo/config | jq '.vanityName'  # "demo"

# P7 final gate
grep -rn "requirePremium" app/convex/{theming,embed,analytics}.ts  # present on every premium mutation
grep -rn "NEXT_PUBLIC" app/src app/convex | grep -iE "api_key|deploy_key|resend"  # → no matches
# identity-derivation audit: every ownerId in queries/mutations traced to ctx.auth (manual pass, noted in PR)
cd .. && pixi run pytest -q                                        # Python still green
```

Evidence bar for "deployed correctly": every command above green + scrollbacks of (a) the new stack's page load on its Vercel domain, (b) Resend API 200 + message id in Convex logs (inbox receipt if/when the Resend domain is re-verified), (c) preview URL building green with its own Convex backend, (d) before/after `dig` + homepage curls proving `shortmail.nonlinearlabs.ai` still serves the Modal app.
