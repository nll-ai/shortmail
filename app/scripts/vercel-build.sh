#!/bin/bash
# Vercel build.
#
# Production (CONVEX_DEPLOY_KEY=prod:…, VERCEL_ENV=production) deploys to the
# production Convex deployment and does not import or export data.
#
# Preview (CONVEX_DEPLOY_KEY=preview:…, VERCEL_ENV=preview) deploys to the
# branch's Convex preview deployment, stamps that deployment's env, and
# hydrates it from production. Hydration defaults to on-create: the first
# build of a preview deployment imports a production snapshot, and later
# pushes to the same branch leave that database in place.
#
# The preview deploy key never receives --prod. The production deploy key is
# used only for `npx convex export --prod`.
set -euo pipefail
cd "$(dirname "$0")/.."

PLAN="$(node scripts/preview/deploy-plan.mjs plan)"

plan_field() {
  node --input-type=module -e '
    const fs = await import("node:fs");
    const plan = JSON.parse(fs.readFileSync(0, "utf8"));
    const value = plan[process.argv[1]];
    if (value === undefined || value === null) process.exit(2);
    process.stdout.write(String(value));
  ' "$1" <<<"$PLAN"
}

KIND="$(plan_field kind)"
if [[ "$KIND" == "refuse" ]]; then
  plan_field reason >&2
  exit 1
fi

if [[ "$KIND" == "local" ]]; then
  echo "==> CONVEX_DEPLOY_KEY not set: building with existing NEXT_PUBLIC_CONVEX_URL"
  npm run build
  exit 0
fi

if [[ "$KIND" == "production" ]]; then
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
  npx convex env --prod set WORKOS_AUTHKIT_ISSUER https://fair-rose-65.authkit.app
  npx convex env --prod set SHORTMAIL_MCP_RESOURCE https://shortmail.nonlinearlabs.ai/mcp
  npx convex deploy --cmd "npm run build" --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
  echo "==> Backfilling subject heading and FAQ order"
  npx convex run --prod migrate:backfillListOrder '{}'
  exit 0
fi

if [[ "$KIND" != "preview" ]]; then
  echo "Unknown build kind: $KIND" >&2
  exit 1
fi

PREVIEW_NAME="$(plan_field previewName)"
ORIGIN="$(plan_field origin)"
HYDRATE_MODE="$(plan_field hydrateMode)"
SCRUB="$(plan_field scrub)"
REMOVE_RESEND="$(plan_field removeResend)"
EXPORT_TIMEOUT="$(plan_field exportTimeoutSec)"
IMPORT_TIMEOUT="$(plan_field importTimeoutSec)"
MAX_BYTES="$(plan_field maxSnapshotBytes)"

echo "==> Convex preview deploy for ${PREVIEW_NAME}"
echo "==> Preview origin ${ORIGIN}"

ENV_FILE=""
SNAPSHOT_DIR=""
cleanup() {
  if [[ -n "$ENV_FILE" ]]; then rm -f "$ENV_FILE"; fi
  # Only remove the directory this script created. An empty or unexpected
  # value must not become `rm -rf`.
  if [[ "$SNAPSHOT_DIR" == /tmp/shortmail-preview.* ]]; then
    rm -rf "$SNAPSHOT_DIR"
  fi
}
trap cleanup EXIT

# Stamp preview mode and drop any copied Resend key. A reused preview gets
# this before the new functions are pushed. A brand-new preview does not
# exist yet, so that attempt can fail; the same commands run again after
# deploy and that second run must succeed before Vercel serves the URL.
configure_preview_env() {
  local file
  file="$(mktemp)"
  ENV_FILE="$file"
  if ! node scripts/preview/deploy-plan.mjs write-env --out "$file" --origin "$ORIGIN"; then
    rm -f "$file"
    ENV_FILE=""
    return 1
  fi
  if ! npx convex env --preview-name "$PREVIEW_NAME" set --from-file "$file" --force; then
    rm -f "$file"
    ENV_FILE=""
    return 1
  fi
  rm -f "$file"
  ENV_FILE=""
  if [[ "$REMOVE_RESEND" == "true" ]]; then
    # `env remove` succeeds when the variable is already absent.
    npx convex env --preview-name "$PREVIEW_NAME" remove RESEND_API_KEY || return 1
  fi
}

umask 077
if configure_preview_env; then
  echo "==> Preview env set before deploy"
else
  echo "==> Preview deployment is not configurable yet; env will be set after deploy"
fi

# `npx convex deploy` injects this preview's URL as NEXT_PUBLIC_CONVEX_URL
# for the Next.js build and for widget.js.
#
# A brand-new preview does not exist until this deploy creates it, so the
# env write above can fail. Convex then rejects auth.config.ts because
# WORKOS_AUTHKIT_ISSUER is referenced and still unset. Write the env once
# the deployment exists and deploy a second time.
deploy_preview() {
  npx convex deploy \
    --preview-name "$PREVIEW_NAME" \
    --cmd "npm run build" \
    --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
    --preview-run "devSeed:seedDemo"
}

set +e
deploy_preview
deploy_status=$?
set -e
if [[ "$deploy_status" -ne 0 ]]; then
  echo "==> Convex preview deploy failed; writing env and retrying once"
  configure_preview_env
  deploy_preview
fi

configure_preview_env

NAMES="$(npx convex env --preview-name "$PREVIEW_NAME" list --names-only)"
PRESENT="no"
if grep -qx "SHORTMAIL_PREVIEW_HYDRATED_AT" <<<"$NAMES"; then
  PRESENT="yes"
fi
DO_HYDRATE="$(node scripts/preview/deploy-plan.mjs should-hydrate --mode "$HYDRATE_MODE" --present "$PRESENT")"

if [[ "$DO_HYDRATE" == "yes" ]]; then
  case "${CONVEX_PROD_DEPLOY_KEY:-}" in
    prod:*) ;;
    *)
      echo "CONVEX_PROD_DEPLOY_KEY must be a production deploy key before export." >&2
      exit 1
      ;;
  esac
  if ! command -v timeout >/dev/null 2>&1; then
    echo "The timeout command is required for the production snapshot." >&2
    exit 1
  fi
  # `npx convex export --path` refuses a path that already exists. mktemp
  # creates its file, so the zip lives in a fresh directory and is not
  # created until export downloads it.
  SNAPSHOT_DIR="$(mktemp -d /tmp/shortmail-preview.XXXXXX)"
  SNAPSHOT="$SNAPSHOT_DIR/snapshot.zip"
  echo "==> Exporting production snapshot (timeout ${EXPORT_TIMEOUT}s, max ${MAX_BYTES} bytes)"
  # The production key is inherited by the export process. It is not placed
  # on the command line, and the preview key remains the parent shell's key.
  (
    export CONVEX_DEPLOY_KEY="$CONVEX_PROD_DEPLOY_KEY"
    timeout "$EXPORT_TIMEOUT" npx convex export --prod --path "$SNAPSHOT"
  )
  node scripts/preview/deploy-plan.mjs assert-snapshot --file "$SNAPSHOT" --max "$MAX_BYTES"
  echo "==> Importing snapshot into preview ${PREVIEW_NAME}"
  timeout "$IMPORT_TIMEOUT" npx convex import \
    --preview-name "$PREVIEW_NAME" \
    --replace \
    --yes \
    "$SNAPSHOT"
  rm -rf "$SNAPSHOT_DIR"
  SNAPSHOT_DIR=""
  STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  npx convex env --preview-name "$PREVIEW_NAME" set SHORTMAIL_PREVIEW_HYDRATED_AT "$STAMP"
else
  echo "==> Skipping production snapshot (${HYDRATE_MODE}, marker present: ${PRESENT})"
fi

# Scrub is idempotent and independent of this build's import. Turning it on
# after the first hydrate still rewrites account emails on the next push.
if [[ "$SCRUB" == "true" ]]; then
  echo "==> Scrubbing preview account emails"
  npx convex run --preview-name "$PREVIEW_NAME" previewScrub:scrubPii '{}'
fi

echo "==> Seeding demo vanities that the snapshot did not already contain"
npx convex run --preview-name "$PREVIEW_NAME" devSeed:seedDemo '{}'
echo "==> Backfilling subject heading and FAQ order"
npx convex run --preview-name "$PREVIEW_NAME" migrate:backfillListOrder '{}'
echo "==> Preview deploy finished"
