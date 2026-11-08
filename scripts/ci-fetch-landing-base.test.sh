#!/usr/bin/env bash
# Regression: the old App workflow wrote origin/main into refs/heads/main.
# That fails when main is already checked out. The replacement always writes
# refs/remotes/origin/main and leaves a usable base for the landing diff.
#
# Uses synthetic repos so PR runners (no local refs/heads/main) and main
# push runners are both covered.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIX="$ROOT/scripts/ci-fetch-landing-base.sh"
OLD_FETCH=(git fetch --no-tags --depth=1 origin +main:refs/heads/main)
LANDING_PATHS=(app/src/widget/formSkin.ts app/src/app/layout.tsx)
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

init_upstream() {
  local dir="$1"
  mkdir -p "$dir/app/src/widget" "$dir/app/src/app"
  git -C "$dir" init -q -b main
  git -C "$dir" config user.email "ci@example.com"
  git -C "$dir" config user.name "CI"
  printf 'skin\n' >"$dir/app/src/widget/formSkin.ts"
  printf 'layout\n' >"$dir/app/src/app/layout.tsx"
  git -C "$dir" add app
  git -C "$dir" commit -qm "landing base"
}

assert_landing_diff() {
  local repo="$1"
  local base="$2"
  git -C "$repo" rev-parse --verify "$base" >/dev/null
  git -C "$repo" diff --quiet "$base" -- "${LANDING_PATHS[@]}"
}

echo "== build upstream with a main tip =="
init_upstream "$WORKDIR/upstream"
UPSTREAM="file://${WORKDIR}/upstream"

echo "== main checkout: old fetch must fail =="
git clone --depth=1 "$UPSTREAM" "$WORKDIR/main-shape" >/dev/null
(
  cd "$WORKDIR/main-shape"
  current="$(git branch --show-current)"
  if [ "$current" != "main" ]; then
    echo "expected main checkout, got ${current}" >&2
    exit 1
  fi
  set +e
  "${OLD_FETCH[@]}" >/tmp/old-main-fetch.out 2>/tmp/old-main-fetch.err
  status=$?
  set -e
  if [ "$status" -ne 128 ]; then
    echo "old fetch exit=${status}, expected 128" >&2
    cat /tmp/old-main-fetch.err >&2 || true
    exit 1
  fi
  grep -q "refusing to fetch into branch 'refs/heads/main'" /tmp/old-main-fetch.err
)

echo "== main checkout: new fetch must leave origin/main for the landing diff =="
(
  cd "$WORKDIR/main-shape"
  bash "$FIX" origin main
  assert_landing_diff "$WORKDIR/main-shape" origin/main
)

echo "== detached PR-like shallow checkout: no local main, no origin/main =="
git clone --depth=1 "$UPSTREAM" "$WORKDIR/pr-shape" >/dev/null
(
  cd "$WORKDIR/pr-shape"
  git checkout --detach HEAD >/dev/null
  git branch -D main >/dev/null
  git update-ref -d refs/remotes/origin/main
  if git rev-parse --verify refs/heads/main >/dev/null 2>&1; then
    echo "local main still present before fix" >&2
    exit 1
  fi
  if git rev-parse --verify refs/remotes/origin/main >/dev/null 2>&1; then
    echo "origin/main still present before fix" >&2
    exit 1
  fi
  bash "$FIX" origin main
  if git show-ref --verify --quiet refs/heads/main; then
    echo "local main must stay absent on the PR shape" >&2
    exit 1
  fi
  assert_landing_diff "$WORKDIR/pr-shape" origin/main
)

echo "ci-fetch-landing-base regression ok"
