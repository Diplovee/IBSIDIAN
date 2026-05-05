#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

bun run sync:excalidraw-assets
if [ ! -f "out/main/index.js" ]; then
  bun run build
fi

exec bunx electron .
