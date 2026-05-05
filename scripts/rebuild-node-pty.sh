#!/usr/bin/env bash
set -euo pipefail

# Rebuild node-pty native module for Arch Linux
# Ensure python-setuptools is installed: sudo pacman -S python-setuptools

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Rebuilding node-pty..."
bunx electron-rebuild -f -w node-pty
