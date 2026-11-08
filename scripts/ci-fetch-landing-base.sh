#!/usr/bin/env bash
# Ensure refs/remotes/origin/main exists for the landing source diff guard.
# Never writes refs/heads/main, so this is safe on a checked-out main branch
# (push to main) and on a detached PR checkout.
set -euo pipefail

remote="${1:-origin}"
branch="${2:-main}"

git fetch --no-tags --depth=1 "$remote" "+${branch}:refs/remotes/origin/${branch}"
git rev-parse --verify "refs/remotes/origin/${branch}" >/dev/null
