#!/usr/bin/env bash

set -euo pipefail

PACKAGE_DIR="${1:-pkgs}"

shopt -s nullglob
packages=("$PACKAGE_DIR"/*.tgz)

if ((${#packages[@]} == 0)); then
  echo "No npm package tarballs found in $PACKAGE_DIR." >&2
  exit 1
fi

for package_file in "${packages[@]}"; do
  if ! tar -tzf "$package_file" | grep -qx 'package/THIRD_PARTY_NOTICES.txt'; then
    echo "$package_file is missing package/THIRD_PARTY_NOTICES.txt." >&2
    exit 1
  fi
done
