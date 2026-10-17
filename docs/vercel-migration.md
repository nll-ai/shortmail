# Vercel + Convex migration — operations runbook

The new stack (this repo's `app/` directory) runs on **Vercel** (Next.js 16)
with **Convex** as the backend. The legacy FastAPI app still runs on Modal at
`shortmail.nonlinearlabs.ai` — production DNS has **not** been cut over.

## Deployments

| Surface | URL | Convex backend |
|---|---|---|
| Production (new stack) | https://shortmail-gamma.vercel.app | `hallowed-leopard-387` (prod deployment) |
| Per-PR previews | `shortmail-<hash>-eric-mas-projects-a230afd1.vercel.app` | fresh per-branch backend, auto-seeded |
| Legacy production (Modal) | https://shortmail.nonlinearlabs.ai | SQLite on Modal volume `shortmail` |

## Environment inventory

### Vercel project `shortmail` (team `eric-mas-projects-a230afd1`)
- Root Directory: `app`; build command: `bash scripts/vercel-build.sh`
  (runs `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`
  plus the widget esbuild step via `package.json` `build`)
- `CONVEX_DEPLOY_KEY` — **production** deploy key → target `production` only
- `CONVEX_DEPLOY_KEY` — **preview** deploy key → target `preview` (per-branch
  Convex backends; auto-cleanup ~5 days)
- `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (≥32 chars),
  `SUPER_ADMIN_EMAIL`, `RESEND_API_KEY` — all environments
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` = `https://shortmail-gamma.vercel.app/callback`

### Convex project `eric-036a4/shortmail`
- dev: `gallant-dogfish-30`; prod: `hallowed-leopard-387` (default prod);
  preview deployments per branch
- Env vars per deployment: `WORKOS_CLIENT_ID`, `SUPER_ADMIN_EMAIL`,
  `RESEND_API_KEY`
- Project **Default Environment Variables** (applied to new deployments):
  same three keys — set via dashboard Settings → Default Environment Variables

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

1. Add `shortmail.nonlinearlabs.ai` to the Vercel project (Domains tab).
2. In Cloudflare DNS, change the existing `shortmail` record content to
   `cname.vercel-dns.com`. Grey-cloud is Vercel's recommendation; if you keep
   it orange-cloud, SSL/TLS must be **Full (strict)** and
   `/.well-known/acme-challenge/*` must pass through untouched.
3. Remove `custom_domains` from `deployments/app_deploy.py` and `modal deploy`
   (retires the Modal serving path).
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
- Embedding is script-based (web component), never an iframe. Host pages can
  read what visitors type — owners can restrict origins per account.

## Maintenance notes

- Releasing new versions: bump the BUSL `Change Date` to four years from the
  release date (`LICENSE`).
- `scripts/vercel-build.sh` deploys Convex functions before `next build`;
  `scripts/build-widget.mjs` rebuilds `public/widget.js` with the baked
  Convex site URL. Both run on every Vercel build.
- npm lifecycle scripts are disabled in Vercel builds — do not rely on
  `pre*` hooks; chain commands in the `build` script instead.
