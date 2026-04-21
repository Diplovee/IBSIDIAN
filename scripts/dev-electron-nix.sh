#!/usr/bin/env bash
set -euo pipefail

libegl="$(ls -1 /nix/store/*-libglvnd-*/lib/libEGL.so.1 2>/dev/null | head -n1 || true)"
if [[ -n "$libegl" ]]; then
  libglvnd_lib_dir="$(dirname "$libegl")"
  export NIX_LD_LIBRARY_PATH="${libglvnd_lib_dir}:${NIX_LD_LIBRARY_PATH:-}"
fi

bun run sync:excalidraw-assets
exec electron-vite dev
