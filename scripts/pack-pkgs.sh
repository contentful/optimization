#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

rm -rf pkgs
mkdir -p pkgs

FILTERS=()
while IFS= read -r package; do
  [ -n "$package" ] || continue
  FILTERS+=(--filter "$package")
done < <("$ROOT_DIR/node_modules/.bin/tsx" "$ROOT_DIR/scripts/list-npm-package-targets.ts" npm-package-names)

pnpm pack "${FILTERS[@]}" --pack-destination pkgs
