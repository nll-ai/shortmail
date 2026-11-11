# Preview deployments

Every Vercel preview build of `app/` deploys Convex functions to a preview
deployment for that git branch, bakes that deployment's URL into the Next.js
app and `widget.js`, and can copy production data into the preview database.
Production builds keep deploying to Convex deployment `hallowed-leopard-387`.

Vercel project: `shortmail` (`prj_cXq7wahRknr1gCAijhAy4dS6HckH`), team
`eric-mas-projects-a230afd1`. Root directory: `app`. Build command:
`bash scripts/vercel-build.sh` (already set).

Convex chooses the target from `CONVEX_DEPLOY_KEY`:

- `prod:…` on the Vercel **Production** environment deploys to production.
  The script does not export or import data on that path.
- `preview:…` on the Vercel **Preview** environment runs
  `npx convex deploy --preview-name "$VERCEL_GIT_COMMIT_REF" --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`.
  Convex documents this as the Vercel preview flow. The hidden
  `--preview-name` flag on `env`, `import`, and `run` (Convex CLI 1.47)
  targets that same branch afterwards.
- A preview Vercel build that was given a `prod:` key fails before any
  Convex command. A production Vercel build that was given a `preview:` key
  fails the same way. The CLI also refuses a production key when
  `VERCEL_ENV` is not `production`.

`npm run build` runs `scripts/build-widget.mjs`, which rewrites
`.convex.cloud` to `.convex.site` on whatever `NEXT_PUBLIC_CONVEX_URL` the
deploy command injected. A preview widget therefore calls that preview's
HTTP actions, not `hallowed-leopard-387.convex.site`.

WorkOS callback hosts are unchanged. `callbackUrlFor` already accepts
`shortmail-git-…-eric-mas-projects-a230afd1.vercel.app` and the per-deployment
`shortmail-…-eric-mas-projects-a230afd1.vercel.app` host. Preview builds set
the Convex env var `SHORTMAIL_PUBLIC_ORIGIN` to `https://$VERCEL_BRANCH_URL`
(the stable branch alias) so verification links point at the preview.

## Hydration

Default: **`SHORTMAIL_PREVIEW_HYDRATE=on-create`**.

The first build of a branch's Convex preview deployment exports a zip from
production (`npx convex export --prod`, using `CONVEX_PROD_DEPLOY_KEY` only
for that subprocess) and imports it with
`npx convex import --preview-name <branch> --replace --yes`. It then sets
`SHORTMAIL_PREVIEW_HYDRATED_AT` on the preview deployment. Later pushes to
the same branch reuse the deployment and skip the copy, so edits made on
the preview survive and the production snapshot is not pulled through the
build machine on every push.

That is the default because the database holds real people's emails and
letters' subjects, and because a full replace on every push would wipe
preview testing. Re-copy when you want a fresh production snapshot:

| `SHORTMAIL_PREVIEW_HYDRATE` | Behavior |
|---|---|
| `on-create` (default) | Import only when the preview has no hydrate marker. |
| `always` | `--replace` from production on every preview build. Idempotent: the preview tables match the snapshot, they are not appended. |
| `skip` | Do not export or import. `devSeed:seedDemo` still runs. |

Convex auto-deletes idle previews (about 5 days, or 14 on a paid plan).
The next build creates a new deployment without the marker and hydrates
again. A failed import does not set the marker, so the next push retries.
Convex applies a zip import per table atomically; the script also deletes
the zip from `/tmp` when the build exits. The export does not include file
storage. The zip must be non-empty and at most
`SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES` (default 100 MiB). Export and import
are wrapped in `timeout` (default 180s and 300s). Oversized snapshots,
timeouts, and a missing production key fail the build.

`devSeed:seedDemo` runs after the import. `--preview-run` only runs when
Convex creates the deployment, and the import would replace those rows, so
the explicit run is what leaves the `demo` vanity in place when production
does not already have it.

## Mail safety

Preview deployments set `SHORTMAIL_PREVIEW=1`. While that is set, Convex
will not call Resend for an address outside `SHORTMAIL_EMAIL_ALLOWLIST`.

- No allowlist: every send and verification code is blocked. Letter
  actions return without scheduling a retry. Verification returns
  `unavailable`.
- Allowlisted recipient, and `SHORTMAIL_PREVIEW_RESEND_API_KEY` was copied
  in as `RESEND_API_KEY`: that person receives their own mail.
- `SHORTMAIL_PREVIEW_EMAIL_SINK` set to an allowlisted address: preview
  **letters** are redirected there with a `[preview]` subject. Verification
  codes are never redirected.
- The production `RESEND_API_KEY` is not copied. Each preview build runs
  `npx convex env remove RESEND_API_KEY` unless the separate preview key
  is set, including when a Convex project default put the production key
  on a new deployment.
- `SHORTMAIL_PREVIEW` on the production deployment fails the production
  build when the deploy key can list env names. Do not set it there.

The guard is in `app/convex/lib/previewMail.ts` and is the control that
matters if a key is present anyway.

## PII scrub (off by default)

Eric's default is a full production copy, so a preview can show real
vanities, headings, and FAQs. That copy includes real account emails.
Outbound mail is blocked as above, but anyone who can open the preview
dashboard or the Convex data UI can read those rows. The zip also exists
on the Vercel build machine until the script deletes it.

Set `SHORTMAIL_PREVIEW_SCRUB=1` to rewrite every user email except
`SUPER_ADMIN_EMAIL` and `SHORTMAIL_EMAIL_ALLOWLIST` to
`preview+<id>@shortmail-preview.invalid` (a reserved TLD) and to replace
those display names with the vanity. The mutation refuses to run unless
`SHORTMAIL_PREVIEW=1`. It does **not** rewrite headings, FAQ text, or
event subjects. Those strings are the product content the preview is for,
and they can still name people or quote a letter subject. Scrub runs on
every preview build when the flag is on, including builds that skip a new
import. Turn the flag off to stop rewriting; it does not restore the
original emails. Hydrate with `always` to copy production again.

## One-time setup (in order)

Do this in the dashboards. Names only; do not commit the values.

1. **Convex production deploy key** for Vercel Production.
   Convex dashboard → deployment `hallowed-leopard-387` → Settings →
   Deploy Keys → Generate. Enable deploy permission. Vercel → project
   `shortmail` → Settings → Environment Variables:
   - Name: `CONVEX_DEPLOY_KEY`
   - Environments: **Production only**
   - Value: the `prod:…` key

2. **Convex preview deploy key** for Vercel Preview.
   Convex dashboard → project Settings → Generate Preview Deploy Key.
   Vercel environment variable:
   - Name: `CONVEX_DEPLOY_KEY`
   - Environments: **Preview only**
   - Value: the `preview:…` key
   Vercel stores one value per environment, so this does not replace the
   production key.

3. **Production export key** for hydration.
   Create a second key on deployment `hallowed-leopard-387` that can export
   data. Prefer a key that can export and cannot deploy, if the dialog
   allows that split. Vercel environment variable:
   - Name: `CONVEX_PROD_DEPLOY_KEY`
   - Environments: **Preview only**
   - Value: a `prod:…` key
   The preview build uses this only as `CONVEX_DEPLOY_KEY` for
   `npx convex export --prod`. It must not be the preview key. Leave it
   unset and set `SHORTMAIL_PREVIEW_HYDRATE=skip` if a preview should not
   copy production.

4. **Preview build environment** (Vercel → Preview):
   - `WORKOS_CLIENT_ID` (already used by AuthKit)
   - `WORKOS_API_KEY`
   - `WORKOS_COOKIE_PASSWORD` (at least 32 characters; can match production)
   - `SUPER_ADMIN_EMAIL`
   - `SHORTMAIL_EMAIL_ALLOWLIST` — comma-separated addresses that may
     receive preview mail, for example the operator's own address. Empty
     means no preview mail is sent.
   - `SHORTMAIL_PREVIEW_RESEND_API_KEY` — optional Resend key that is **not**
     the production key. Omit it to keep preview mail blocked even for the
     allowlist.
   - `SHORTMAIL_PREVIEW_EMAIL_SINK` — optional; must be one allowlisted
     address. Omit it to block non-allowlisted letters instead of
     redirecting them.
   - `SHORTMAIL_PREVIEW_HYDRATE` — omit for `on-create`
   - `SHORTMAIL_PREVIEW_SCRUB` — omit for a full copy; set to `1` to scrub
     account emails
   - Do **not** set `RESEND_API_KEY` on the Preview environment.
   - Do **not** set `SHORTMAIL_PREVIEW` on Production.

5. **Convex production env** (dashboard, deployment `hallowed-leopard-387`),
   unchanged by the build:
   - `RESEND_API_KEY`
   - `SHORTMAIL_PUBLIC_ORIGIN` = `https://shortmail.nonlinearlabs.ai`
   - `SUPER_ADMIN_EMAIL`
   - `WORKOS_CLIENT_ID`
   - `SHORTMAIL_PREVIEW` unset
   Remove `RESEND_API_KEY` from Convex **project default** environment
   variables if it is set there. The preview build deletes it from each
   preview deployment anyway; a default would put it back on the next
   brand-new preview until that delete runs.

6. **GitHub Actions secrets** for `.github/workflows/cleanup-previews.yml`.
   The workflow already pins `VERCEL_PROJECT_ID` to
   `prj_cXq7wahRknr1gCAijhAy4dS6HckH` and `VERCEL_ORG_ID` to
   `eric-mas-projects-a230afd1`.
   - `VERCEL_TOKEN` — token that can list and delete deployments and
     aliases for that team and project. It cannot be given a reason to
     touch production: the job refuses `main` and `master`, refuses
     `target=production`, and refuses the canonical hostnames.
   - `CONVEX_ACCESS_TOKEN` — Convex team access token (team settings →
     access tokens) that can list deployments and delete a deployment.
     A preview deploy key cannot list by project, so this is a team token,
     not `CONVEX_DEPLOY_KEY`.
   - `CONVEX_PROJECT_ID` — the numeric Convex project id (not the slug
     `shortmail`). Project settings, or the List Projects management API.

7. **WorkOS** — no new AuthKit application redirect URI. Preview hosts are
   already allowed. Production callbacks stay on the canonical host and
   gamma. MCP clients register their own redirect URI through dynamic
   client registration or a client ID metadata document. That registration,
   and the MCP resource indicators, are a separate WorkOS change described
   on `/connect`.

8. **MCP audience on Convex.** Preview builds set `WORKOS_AUTHKIT_ISSUER`
   and `SHORTMAIL_MCP_RESOURCE` (`https://<branch-alias>/mcp`) on the
   preview deployment. Production builds set the issuer to
   `https://fair-rose-65.authkit.app` and the resource to
   `https://shortmail.nonlinearlabs.ai/mcp`. Connect preview agents to the
   branch alias, not the one-off deployment hostname. The token audience
   has to match the resource Convex was given.

The cleanup workflow runs on `pull_request` `closed` (merged or not) and on
branch `delete`. It is a no-op for forks, tags, and `main`/`master`. A
manual run is **Actions → Cleanup previews → Run workflow**. That form
defaults to dry-run. Closing a pull request and deleting the branch both
run it; the second run finds the resources already gone and exits 0.
Convex also expires previews on its own; this job deletes them when the
branch is finished instead of waiting.

## How to verify

Local checks (no Convex or Vercel credentials; this is what CI runs):

```bash
cd app
npx vitest run scripts/preview/deploy-plan.test.ts scripts/vercel-build.test.ts scripts/preview/cleanup-plan.test.ts convex/lib/previewMail.test.ts convex/lib/previewScrub.test.ts scripts/build-widget.test.ts
npx tsc --noEmit
```

After the environment variables above exist, open a pull request and confirm:

1. The Vercel preview build log says `Convex preview deploy for <branch>`
   and, on the first build, `Exporting production snapshot` /
   `Importing snapshot`. The next push says `Skipping production snapshot`.
2. The preview page's `/widget.js` contains the preview
   `*.convex.site` host and does not contain `hallowed-leopard-387`.
3. The Convex dashboard shows a preview deployment for the branch, with
   `SHORTMAIL_PREVIEW=1`, `SHORTMAIL_PUBLIC_ORIGIN` set to the branch alias,
   and **no** `RESEND_API_KEY` unless `SHORTMAIL_PREVIEW_RESEND_API_KEY` was
   set.
4. Submitting a letter to a copied production user does not deliver mail.
   Convex logs show `preview blocked` and do not show a Resend success line.
   An allowlisted address receives mail only when the preview Resend key is set.
5. Production deployment `hallowed-leopard-387` still has its functions and
   its `RESEND_API_KEY`. The production site is unchanged.
6. Close or merge the pull request. The **Cleanup previews** job logs the
   Convex deployment name and the Vercel deployment ids it removed, and
   does not mention `hallowed-leopard-387` or `shortmail-gamma.vercel.app`
   as a delete target. A second run logs `already-gone` or `nothing to remove`.

To rehearse cleanup without deleting, run the workflow manually with
dry-run left on and the branch name filled in.
