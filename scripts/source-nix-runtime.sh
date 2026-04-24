#!/usr/bin/env bash
# Source this file to add common Electron runtime libraries on NixOS.
# shellcheck shell=bash

_append_unique_path() {
  local dir="$1"
  if [[ -z "$dir" || ! -d "$dir" ]]; then
    return
  fi

  local current=":${NIX_LD_LIBRARY_PATH:-}:"
  if [[ "$current" != *":${dir}:"* ]]; then
    if [[ -n "${NIX_LD_LIBRARY_PATH:-}" ]]; then
      export NIX_LD_LIBRARY_PATH="${dir}:${NIX_LD_LIBRARY_PATH}"
    else
      export NIX_LD_LIBRARY_PATH="${dir}"
    fi
  fi
}

_append_first_match_dir() {
  local pattern="$1"
  local match
  match=$(compgen -G "$pattern" | head -n 1 || true)
  if [[ -n "$match" ]]; then
    _append_unique_path "$(dirname "$match")"
  fi
}

if [[ -d /nix/store ]]; then
  for pattern in \
    "/nix/store/*-libglvnd-*/lib/libEGL.so.1" \
    "/nix/store/*-mesa-*/lib/libgbm.so.1" \
    "/nix/store/*-gtk+3-*/lib/libgtk-3.so.0" \
    "/nix/store/*-nss-*/lib/libnss3.so" \
    "/nix/store/*-nspr-*/lib/libnspr4.so" \
    "/nix/store/*-dbus-*/lib/libdbus-1.so.3" \
    "/nix/store/*-alsa-lib-*/lib/libasound.so.2" \
    "/nix/store/*-cups-*/lib/libcups.so.2" \
    "/nix/store/*-atk-*/lib/libatk-1.0.so.0" \
    "/nix/store/*-at-spi2-atk-*/lib/libatk-bridge-2.0.so.0" \
    "/nix/store/*-pango-*/lib/libpango-1.0.so.0" \
    "/nix/store/*-cairo-*/lib/libcairo.so.2" \
    "/nix/store/*-expat-*/lib/libexpat.so.1" \
    "/nix/store/*-libdrm-*/lib/libdrm.so.2" \
    "/nix/store/*-xorg-libX11-*/lib/libX11.so.6" \
    "/nix/store/*-xorg-libXcomposite-*/lib/libXcomposite.so.1" \
    "/nix/store/*-xorg-libXdamage-*/lib/libXdamage.so.1" \
    "/nix/store/*-xorg-libXext-*/lib/libXext.so.6" \
    "/nix/store/*-xorg-libXfixes-*/lib/libXfixes.so.3" \
    "/nix/store/*-xorg-libXrandr-*/lib/libXrandr.so.2" \
    "/nix/store/*-xorg-libxcb-*/lib/libxcb.so.1" \
    "/nix/store/*-xorg-libxkbfile-*/lib/libxkbfile.so.1" \
    "/nix/store/*-xorg-libXScrnSaver-*/lib/libXss.so.1" \
    "/nix/store/*-xorg-libXtst-*/lib/libXtst.so.6"
  do
    _append_first_match_dir "$pattern"
  done
fi

export ELECTRON_OZONE_PLATFORM_HINT="${ELECTRON_OZONE_PLATFORM_HINT:-auto}"
