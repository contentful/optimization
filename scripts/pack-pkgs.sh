#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

rm -rf pkgs
mkdir -p pkgs

pnpm pack \
  --filter "@contentful/optimization-*" \
  --filter "!@contentful/optimization-js-bridge" \
  --pack-destination pkgs
