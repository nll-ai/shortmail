#!/bin/bash
# Push Convex functions to the production deployment (hallowed-leopard-387).
#
# GitHub Actions runs this after App tests pass on push to main.
# Vercel production may still run the same steps when
# SHORTMAIL_CONVEX_DEPLOY_ON_VERCEL=1 (legacy combined frontend+backend build).
#
# Requires CONVEX_DEPLOY_KEY=prod:… targeting hallowed-leopard-387.
set -euo pipefail
cd "$(dirname "$0")/.."

WITH_FRONTEND="${1:-}"

case "${CONVEX_DEPLOY_KEY:-}" in
  prod:*) ;;
  *)
    echo "CONVEX_DEPLOY_KEY must be a production deploy key (prod:…)." >&2
    exit 1
    ;;
esac

echo "==> Convex production deploy (${CONVEX_DEPLOY_KEY%%:*} key)"
if NAMES="$(npx convex env --prod list --names-only)"; then
  if grep -qx "SHORTMAIL_PREVIEW" <<<"$NAMES"; then
    echo "Refusing production deploy: SHORTMAIL_PREVIEW is set on the production Convex deployment." >&2
    exit 1
  fi
else
  echo "warning: could not list production Convex env names; continuing the production function deploy" >&2
fi

echo "==> Publishing the MCP token audience on the production Convex deployment"
ISSUER="$(node --input-type=module -e '
  import { resolveAuthkitIssuer } from "./src/mcp/authkit-issuer.mjs";
  const issuer = resolveAuthkitIssuer(process.env);
  if (!issuer) {
    console.error("Cannot resolve the AuthKit issuer for this build.");
    process.exit(1);
  }
  process.stdout.write(issuer);
')"
npx convex env --prod set WORKOS_AUTHKIT_ISSUER "$ISSUER"
npx convex env --prod set SHORTMAIL_MCP_RESOURCE https://shortmail.nonlinearlabs.ai/mcp

if [[ "$WITH_FRONTEND" == "--with-frontend-build" ]]; then
  npx convex deploy --cmd "npm run build" --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
else
  npx convex deploy
fi

echo "==> Backfilling subject heading and FAQ order"
npx convex run --prod migrate:backfillListOrder '{}'
echo "==> Convex production deploy finished"