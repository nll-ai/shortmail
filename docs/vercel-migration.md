# Vercel + Convex migration — operations runbook

The new stack (this repo's `app/` directory) runs on **Vercel** (Next.js 16)
with **Convex** as the backend. The canonical hostname is
`shortmail.nonlinearlabs.ai`. Production DNS has **not** been cut over, so
that name still reaches the legacy FastAPI app on Modal. The Next.js app
already trusts HTTPS on that host for a same-host WorkOS callback, and the
embed snippet uses it. `https://shortmail-gamma.vercel.app` stays up through
the transition, including for embeds that already point there.

## Deployments

| Surface | URL | Backend |
|---|---|---|
| Live Vercel production | https://shortmail-gamma.vercel.app | Convex `hallowed-leopard-387` |
| Canonical hostname | https://shortmail.nonlinearlabs.ai | Still Modal (SQLite volume `shortmail`) until DNS cutover. App code is ready for this host. |
| Per-PR previews | `shortmail-<hash>-eric-mas-projects-a230afd1.vercel.app` and `shortmail-git-<branch>-…` | that branch's Convex preview deployment. See `docs/preview-deployments.md`. |

## Environment inventory

### Vercel project `shortmail` (team `eric-mas-projects-a230afd1`)
- Root Directory: `app`; build command: `bash scripts/vercel-build.sh`
  (runs `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`
  plus the widget esbuild step via `package.json` `build`)
- Preview keys, production hydration, and the mail block are in
  `docs/preview-deployments.md`. Do not put the production `RESEND_API_KEY`
  on the Vercel Preview environment or on Convex preview deployments.
- `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (≥32 chars),
  `SUPER_ADMIN_EMAIL` — Production and Preview
- `RESEND_API_KEY` — not required on Vercel. Convex production reads it.
  Previews use `SHORTMAIL_PREVIEW_RESEND_API_KEY` only when preview mail
  should actually send, and only to `SHORTMAIL_EMAIL_ALLOWLIST`.
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` = `https://shortmail-gamma.vercel.app/callback`

### Stripe billing (ShortMail sandbox, test mode only)

Dedicated Stripe account **ShortMail** (`acct_1UbK9s0rcd9B0yFQ`). Do not use the Learn Anything account.

| Variable | Where |
|---|---|
| `STRIPE_SECRET_KEY` | Vercel (Production + Preview) |
| `STRIPE_WEBHOOK_SECRET` | Vercel (Production + Preview) — endpoint `https://<host>/api/webhooks/stripe` |
| `BILLING_INTERNAL_SECRET` | Vercel **and** Convex (same value; secures webhook → Convex sync) |
| `STRIPE_BILLING_LAUNCH_AT` | Convex (ISO date or Unix ms; starts founding window) |
| `STRIPE_FOUNDING_CAP` | Convex (optional, default `100`) |
| `STRIPE_FOUNDING_WINDOW_DAYS` | Convex (optional, default `90`) |

One-time product setup (test mode): `node scripts/stripe-setup-products.mjs` with `STRIPE_SECRET_KEY` set. Prices use lookup keys `shortmail_premium_yearly` and `shortmail_premium_founding_yearly`. The same script creates comp coupons `shortmail_comp_lifetime` and `shortmail_comp_1yr`. Statement descriptor **SHORTMAIL** is set on the product.

Admin comping and legacy migration: see [billing-comp-premium.md](./billing-comp-premium.md).

### Convex project `eric-036a4/shortmail`
- dev: `gallant-dogfish-30`; prod: `hallowed-leopard-387` (default prod);
  preview deployments per branch (`docs/preview-deployments.md`)
- Production env: `WORKOS_CLIENT_ID`, `SUPER_ADMIN_EMAIL`, `RESEND_API_KEY`,
  `SHORTMAIL_PUBLIC_ORIGIN` = `https://shortmail.nonlinearlabs.ai`
- Do not put `RESEND_API_KEY` in project default environment variables.
  Preview builds set `SHORTMAIL_PREVIEW=1` and remove `RESEND_API_KEY`
  unless a separate preview key was provided.

### WorkOS (Nonlinear Labs, staging environment)
- AuthKit domain: `warm-respect-91-staging.authkit.app`
- JWT template (Authentication → Features): `aud` = client ID,
  `email` = `{{ user.email }}`, `email_verified` = `{{ user.email_verified }}`
  — **required by Convex**; without it every authenticated Convex call fails
- Redirect URIs registered: `http://localhost:3000/callback`,
  `https://shortmail.vercel.app/callback`, `https://shortmail-gamma.vercel.app/callback`,
  `https://shortmail-test.nonlinearlabs.ai/callback`,
  `https://shortmail.nonlinearlabs.ai/callback`,
  `https://shortmail*-eric-mas-projects-a230afd1.vercel.app/callback`
- Helper: `scripts/setup-workos-uris.sh` (idempotent re-registration)

### Resend (nonlinearlabs team)
- Domain `mail.nonlinearlabs.ai` — **Verified** (DKIM/SPF/MX records live in
  Cloudflare: `resend._domainkey.mail` TXT, `send.mail` MX + SPF TXT)
- API key `shortmail-app` (sending access) — wired into Convex env + Vercel

## Test-domain setup (`shortmail-test.nonlinearlabs.ai`, optional)

In the Cloudflare dashboard → zone `nonlinearlabs.ai` → DNS → Add record:

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| CNAME | `shortmail-test` | `cname.vercel-dns.com` | **DNS only (grey cloud)** | Auto |

Then: `vercel domains add shortmail-test.nonlinearlabs.ai` (attach to the
`shortmail` project; the certificate issues automatically).

Equivalent API call (needs a Cloudflare token with Zone → DNS → Edit):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --json '{"type":"CNAME","name":"shortmail-test","content":"cname.vercel-dns.com","proxied":false,"ttl":1}'
```

## Production cutover runbook (NOT executed — Eric's call)

App preparation already in git, and not itself a cutover: HTTPS
`shortmail.nonlinearlabs.ai` is an allowed same-host `/callback`, and embed
copy uses `https://shortmail.nonlinearlabs.ai/widget.js`. Gamma, project
previews, and localhost stay allowed. Untrusted hosts still fall back to
the gamma callback.

Still a separate change, not done here:

1. Add `shortmail.nonlinearlabs.ai` to the Vercel project (Domains tab).
2. In Cloudflare DNS, change the existing `shortmail` record content to
   `cname.vercel-dns.com`. Grey-cloud is Vercel's recommendation; if you keep
   it orange-cloud, SSL/TLS must be **Full (strict)** and
   `/.well-known/acme-challenge/*` must pass through untouched.
3. After the new host has soaked, remove `custom_domains` from
   `deployments/app_deploy.py` and `modal deploy` (retires the Modal serving
   path). Leave that Modal setting in place until then.
4. Rollback = revert step 2 (TTL ~300s).

## Data migration (already executed on both backends)

`convex/migrate.ts` (`migrate:importSqlite`) imported the production SQLite
data (pulled read-only from the Modal volume): 7 legacy user rows merged to
6 Convex users (`ericmajinglong@gmail.com` primary, `ericmjl@hey.com` alias),
6 subject headings, 1 FAQ. Users are **adopted on first login** (matched by
email or alias; WorkOS id stamped; vanity/isPaid/adminRole preserved).

Re-run at cutover only if the Modal database changed since:
`npx convex run migrate:importSqlite "$(cat migration-data.json)"` against
the prod deployment. Note `migrate.ts` upserts by email — safe to re-run.

## Known deltas vs the legacy app

- The send result page is optimistic: the UI says "sent" when Convex accepted
  the submission; actual delivery failures land in Convex logs (legacy app
  was synchronous).
- The hosted send page is a JS-rendered widget (no no-JS fallback).
- Rate limiting is now real (legacy `RateLimiter` existed but was never
  wired): per-vanity daily send cap 200/day (enforced), per-IP windows
  (advisory).
- Sender inbox confirmation exists only on the Convex `/api/send` path
  (Vercel app and `widget.js`). DNS has not been cut over, so
  `shortmail.nonlinearlabs.ai` still serves the legacy FastAPI app, which
  accepts a letter without that proof.
- Sign-in stays on the host that started it when that host is
  `shortmail.nonlinearlabs.ai` (HTTPS only), `shortmail-gamma.vercel.app`,
  a `shortmail-*-eric-mas-projects-a230afd1.vercel.app` preview, or
  localhost. Any other host uses the gamma callback. This is not an open
  redirect, and it does not change WorkOS, Vercel domains, or DNS.
- Embedding is script-based (web component), never an iframe. Dashboard and
  embed docs tell owners to load
  `https://shortmail.nonlinearlabs.ai/widget.js`. Until DNS cutover that
  URL still hits Modal. Existing embeds of
  `https://shortmail-gamma.vercel.app/widget.js` keep working because gamma
  stays up. Host pages can read what visitors type — owners can restrict
  origins per account.

## Maintenance notes

- Releasing new versions: bump the BUSL `Change Date` to four years from the
  release date (`LICENSE`).
- `scripts/vercel-build.sh` deploys Convex functions before `next build`;
  `scripts/build-widget.mjs` rebuilds `public/widget.js` with the baked
  Convex site URL of that build's deployment (preview or production).
  Both run on every Vercel build. Preview data, mail blocking, and
  branch cleanup are in `docs/preview-deployments.md`.
- npm lifecycle scripts are disabled in Vercel builds — do not rely on
  `pre*` hooks; chain commands in the `build` script instead.
