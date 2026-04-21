#!/usr/bin/env bash
set -euo pipefail

exec nix shell \
  nixpkgs#python311 \
  nixpkgs#python311Packages.setuptools \
  nixpkgs#gcc \
  nixpkgs#gnumake \
  nixpkgs#pkg-config \
  -c electron-rebuild -f -w node-pty
