#!/usr/bin/env bash
#
# run-maestro-e2e.sh - Android Maestro E2E runner (preview-panel PoC)
#
# Runs the single Maestro flow set in maestro/preview-panel against BOTH reference
# apps (Compose + XML Views) via Maestro's `appId: ${APP_ID}` parameterization,
# mirroring the iOS single-bundle paradigm. Orchestrates:
#   1. Building the two app debug APKs (unless SKIP_BUILD=true)
#   2. Starting the mock API server (from lib/mocks) on localhost:8000
#   3. adb reverse port forwarding so the emulator can reach localhost
#   4. Installing both app APKs
#   5. Running the Maestro flows against each app package
#   6. Cleaning up background processes on exit
#
# Prerequisites:
#   - A running Android emulator or connected device (this script does NOT launch
#     one — start your emulator first; on Apple Silicon the local arm64 emulator is
#     fast and reliable).
#   - Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - pnpm dependencies installed at the monorepo root.
#
# Environment variables:
#   SKIP_BUILD          - "true" to skip the Gradle build step (default: false)
#   MAESTRO_ITERATIONS  - repeat the full two-app run N times to measure flakes (default: 1)
#   APP_ID              - run only this package instead of both (optional)
#   MOCK_SERVER_PORT    - mock API server port (default: 8000)
#
# Usage:
#   ./scripts/run-maestro-e2e.sh
#   SKIP_BUILD=true ./scripts/run-maestro-e2e.sh
#   MAESTRO_ITERATIONS=10 ./scripts/run-maestro-e2e.sh        # flake sweep
#   APP_ID=com.contentful.optimization.app.views ./scripts/run-maestro-e2e.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_SDK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ANDROID_SDK_DIR/../.." && pwd)"
FLOWS_DIR="$ANDROID_SDK_DIR/maestro/preview-panel"

SKIP_BUILD="${SKIP_BUILD:-false}"
MAESTRO_ITERATIONS="${MAESTRO_ITERATIONS:-1}"
MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"

COMPOSE_PACKAGE="com.contentful.optimization.app"
VIEWS_PACKAGE="com.contentful.optimization.app.views"
COMPOSE_APK="$ANDROID_SDK_DIR/compose/build/outputs/apk/debug/compose-debug.apk"
VIEWS_APK="$ANDROID_SDK_DIR/views/build/outputs/apk/debug/views-debug.apk"

MOCK_SERVER_PID=""

cleanup() {
  if [ -n "$MOCK_SERVER_PID" ]; then
    kill "$MOCK_SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

command -v maestro >/dev/null 2>&1 || {
  echo "ERROR: maestro not found on PATH. Install it with:" >&2
  echo '  curl -Ls "https://get.maestro.mobile.dev" | bash' >&2
  exit 1
}

# Require a connected device/emulator — this script intentionally does not launch one.
if ! adb get-state 1>/dev/null 2>&1; then
  echo "ERROR: no Android device/emulator detected by adb. Start an emulator first." >&2
  exit 1
fi

if [ "$SKIP_BUILD" != "true" ]; then
  echo "Building Compose + Views debug APKs..."
  (cd "$ANDROID_SDK_DIR" && ./gradlew :compose:assembleDebug :views:assembleDebug)
fi

echo "Starting mock server on port $MOCK_SERVER_PORT..."
PORT="$MOCK_SERVER_PORT" pnpm --dir "$REPO_ROOT/lib/mocks" serve >/tmp/maestro-mock-server.log 2>&1 &
MOCK_SERVER_PID=$!
for _ in $(seq 1 60); do
  if nc -z localhost "$MOCK_SERVER_PORT" 2>/dev/null; then
    echo "Mock server is ready"
    break
  fi
  sleep 1
done
if ! nc -z localhost "$MOCK_SERVER_PORT" 2>/dev/null; then
  echo "Mock server failed to start:" >&2
  cat /tmp/maestro-mock-server.log >&2
  exit 1
fi

echo "Setting up adb reverse tcp:$MOCK_SERVER_PORT..."
adb reverse "tcp:$MOCK_SERVER_PORT" "tcp:$MOCK_SERVER_PORT"

echo "Installing app APKs..."
adb install -r "$COMPOSE_APK"
adb install -r "$VIEWS_APK"

# Pick which packages to drive: a single APP_ID override, or both.
if [ -n "${APP_ID:-}" ]; then
  PACKAGES=("$APP_ID")
else
  PACKAGES=("$COMPOSE_PACKAGE" "$VIEWS_PACKAGE")
fi

rc=0
for iteration in $(seq 1 "$MAESTRO_ITERATIONS"); do
  echo "=== iteration $iteration/$MAESTRO_ITERATIONS ==="
  for pkg in "${PACKAGES[@]}"; do
    echo "--- maestro test (APP_ID=$pkg) ---"
    maestro test -e "APP_ID=$pkg" "$FLOWS_DIR" || rc=1
  done
done

exit $rc
