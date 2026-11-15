# Agent instructions (ShortMail)

## Convex deployments (Vercel only)

Vercel is the **only** supported path for deploying Convex for the `app/` stack.

- **Production** Convex (`hallowed-leopard-387`) deploys during the Vercel
  **Production** build: `app/scripts/vercel-build.sh` runs
  `npx convex deploy --cmd …` with the Vercel Production `CONVEX_DEPLOY_KEY`
  (`prod:…`).
- **Preview** Convex backends deploy during Vercel **Preview** builds via the
  same script and the preview deploy key (`preview:…`). See
  `docs/preview-deployments.md`.

Do **not** add Convex deploy steps to GitHub Actions or other CI/CD. Do **not**
run manual `npx convex deploy` against production except in an emergency. A
GitHub Actions–based Convex deploy was deliberately rejected (closed PR #52).

Local development uses `npx convex dev` only; it does not replace the Vercel
deploy path.

Operator runbooks: `docs/vercel-migration.md`, `docs/preview-deployments.md`.