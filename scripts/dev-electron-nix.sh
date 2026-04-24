#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/source-nix-runtime.sh"

bun run sync:excalidraw-assets
exec electron-vite dev
