#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

rm -rf pkgs
mkdir -p pkgs

FILTERS=()
PACKAGE_TARGETS=()
while IFS=$'\t' read -r package package_dir _notice_path; do
  [ -n "$package" ] || continue
  [ -n "$package_dir" ] || continue
  FILTERS+=(--filter "$package")
  PACKAGE_TARGETS+=("$package"$'\t'"$package_dir")
done < <("$ROOT_DIR/node_modules/.bin/tsx" "$ROOT_DIR/scripts/list-npm-package-targets.ts" npm-targets)

pnpm pack "${FILTERS[@]}" --pack-destination pkgs

for package_target in "${PACKAGE_TARGETS[@]}"; do
  IFS=$'\t' read -r package package_dir <<< "$package_target"
  package_file_name="${package#@}"
  package_file_name="${package_file_name//\//-}"
  package_version="$(node -p "require('./${package_dir}/package.json').version")"

  cp "pkgs/${package_file_name}-${package_version}.tgz" "pkgs/${package_file_name}-local.tgz"
done
