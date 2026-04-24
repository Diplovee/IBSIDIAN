#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

echo "[ibsidian] Updating local checkout in ${REPO_ROOT}"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[ibsidian] git pull --ff-only"
  git pull --ff-only
else
  echo "[ibsidian] Warning: not a git checkout, skipping pull"
fi

echo "[ibsidian] Installing dependencies"
bun install

echo "[ibsidian] Building app"
bun run build

if [[ "${1:-}" == "--rebuild" ]]; then
  echo "[ibsidian] Rebuilding native modules"
  bun run rebuild
fi

if [[ "${1:-}" == "--reinstall-launcher" || "${2:-}" == "--reinstall-launcher" ]]; then
  echo "[ibsidian] Reinstalling local app launcher"
  bun run install:linux-local
fi

echo "[ibsidian] Update complete"
