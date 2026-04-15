#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/packages/ios/ios-jsc-bridge"
PACKAGE_DIR="$ROOT_DIR/packages/ios/ContentfulOptimization"
RESOURCES_DIR="$PACKAGE_DIR/Sources/ContentfulOptimization/Resources"

echo "=== Building JS Bridge ==="
cd "$BRIDGE_DIR"
pnpm build

echo "=== Copying UMD bundle to Swift Package resources ==="
cp "$BRIDGE_DIR/dist/optimization-ios-bridge.umd.js" "$RESOURCES_DIR/"

echo "=== Building Swift Package ==="
cd "$PACKAGE_DIR"
swift build

echo "=== Running Swift Package tests ==="
swift test

echo "=== Build complete ==="
