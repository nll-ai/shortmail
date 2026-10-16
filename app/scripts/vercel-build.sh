#!/bin/bash
# Vercel build command wrapper: deploys Convex functions, then builds Next.js
# with the deployment URL injected as NEXT_PUBLIC_CONVEX_URL.
#
# - Production deploy key (prod:*): pushes to the production deployment.
# - Preview deploy key (preview:*): creates/reuses a per-branch preview
#   deployment and seeds demo data (--preview-run).
# - No key (local `vercel deploy` builds): skips the Convex push and builds
#   with NEXT_PUBLIC_CONVEX_URL from the environment (fallback var).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${CONVEX_DEPLOY_KEY:-}" == preview:* ]]; then
  echo "==> Convex PREVIEW deploy (per-branch backend)"
  npx convex env set WORKOS_CLIENT_ID "$WORKOS_CLIENT_ID"
  npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --preview-run 'devSeed:seedDemo'
elif [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "==> Convex PRODUCTION deploy"
  npx convex env set WORKOS_CLIENT_ID "$WORKOS_CLIENT_ID"
  npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
else
  echo "==> CONVEX_DEPLOY_KEY not set: building with existing NEXT_PUBLIC_CONVEX_URL"
  npm run build
fi
