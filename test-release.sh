#!/bin/bash

# TODO: delete me before merging

# Local Test Script for Release Pipeline
set -e  # Exit on any error

echo "Starting local release pipeline test..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f ".nvmrc" ]]; then
    echo "This script must be run from the repository root directory"
    exit 1
fi

# Store current commit hash for reset
ORIGINAL_COMMIT=$(git rev-parse HEAD)

# Execute version bump
echo "Running: pnpm nx release --skip-publish --verbose --first-release"
pnpm nx release --skip-publish --verbose --first-release || {
    echo "Version bump failed"
    exit 1
}

# Get the latest version and update SDK files
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "No tags found")
echo "Latest version: $LATEST_TAG"

if [[ "$LATEST_TAG" != "No tags found" ]]; then
    VERSION=$(echo "$LATEST_TAG" | sed 's/^v//')
    VERSION_CODE="export const SDK_VERSION = '$VERSION' // Auto-generated pre-build."
    
    echo "$VERSION_CODE" > platforms/javascript/node/src/version.ts
    echo "$VERSION_CODE" > platforms/javascript/web/src/version.ts
    echo "$VERSION_CODE" > platforms/javascript/react-native/src/version.ts
    
    echo "SDK version files updated to: $VERSION"
fi

# Build packages
echo "Building packages..."
pnpm build

# Show dist directories
echo "Found dist directories:"
find . -name "dist" -type d | grep -E "(universal|platforms/javascript)" | head -10


# Pack packages into a specific folder
PACK_DIR="pkgs"
mkdir -p "$PACK_DIR"
echo "Packing packages into $PACK_DIR..."
pnpm pack --recursive --filter "@contentful/*" --pack-destination "$PACK_DIR"



# Show changelog
if [[ -f "CHANGELOG.md" ]]; then
    echo "Recent changelog entries:"
    head -20 CHANGELOG.md
fi

# Clean up but keep pkgs/
echo "Test completed - resetting changes but keeping generated packages..."

# Move pkgs to a temp location
PKG_TMP=$(mktemp -d)
mv "$PACK_DIR" "$PKG_TMP/"

# Reset and clean everything else
git reset --hard "$ORIGINAL_COMMIT"
if [[ "$LATEST_TAG" != "No tags found" ]]; then
    git tag -d "$LATEST_TAG" > /dev/null 2>&1
    echo "Deleted tag: $LATEST_TAG"
fi
git clean -fdx

# Move pkgs back
mv "$PKG_TMP/$PACK_DIR" .
rmdir "$PKG_TMP"

echo "Changes reset successfully, pkgs/ folder preserved."