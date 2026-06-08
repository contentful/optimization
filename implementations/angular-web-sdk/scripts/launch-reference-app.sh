#!/usr/bin/env bash
#
# launch-reference-app.sh - One-shot Angular Web SDK Reference Implementation Launcher
#
# Starts the mock API server in the background, then runs the Angular dev server
# in the foreground. Cleans up the mock server on exit (Ctrl+C or any signal).
#
# Environment Variables:
#   MOCK_SERVER_PORT   Port for mock API server (default: 8000)
#   SKIP_BUILD         Set to "true" to skip SDK package build step (default: false)
#   SKIP_INSTALL       Set to "true" to skip dependency installation (default: false)
#
# Usage:
#   ./scripts/launch-reference-app.sh
#   SKIP_BUILD=true ./scripts/launch-reference-app.sh      # skip pnpm build:pkgs
#   SKIP_INSTALL=true ./scripts/launch-reference-app.sh    # skip install entirely
#

set -euo pipefail

# Resolve absolute paths relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMPL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$IMPL_DIR/../.." && pwd)"

# Mock server logs are written here to keep terminal output clean.
LOG_DIR="${IMPL_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
MOCK_SERVER_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"

# Terminate the background mock server when this script exits for any reason.
cleanup() {
  if [[ -n "$MOCK_SERVER_PID" ]] && kill -0 "$MOCK_SERVER_PID" 2>/dev/null; then
    kill -TERM "$MOCK_SERVER_PID" 2>/dev/null || true
    wait "$MOCK_SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "$SKIP_INSTALL" != "true" ]]; then
  # Build local SDK tarballs in pkgs/ so the implementation uses the current
  # source rather than a published registry version.
  if [[ "$SKIP_BUILD" != "true" ]]; then
    echo "[INFO] Building SDK packages..."
    (cd "$ROOT_DIR" && pnpm build:pkgs)
  fi

  # Install the implementation's own dependencies (picks up the tarballs above
  # via pnpm-workspace.yaml overrides).
  echo "[INFO] Installing implementation dependencies..."
  (cd "$ROOT_DIR" && pnpm run implementation:run -- angular-web-sdk implementation:install)
fi

# Bootstrap .env from the example file on first run. The file is gitignored so
# this won't overwrite a developer's local overrides.
if [[ ! -f "${IMPL_DIR}/.env" ]]; then
  cp "${IMPL_DIR}/.env.example" "${IMPL_DIR}/.env"
  echo "[INFO] Created .env from .env.example"
fi

# Start the shared mock API server in the background. It intercepts all SDK
# requests so the app works without a real Contentful space.
mkdir -p "$LOG_DIR"
echo "[INFO] Starting mock server on port ${MOCK_SERVER_PORT}..."
PORT="${MOCK_SERVER_PORT}" pnpm --dir "${ROOT_DIR}/lib/mocks" serve > "$MOCK_SERVER_LOG" 2>&1 &
MOCK_SERVER_PID=$!

# Start the Angular dev server in the foreground. Angular CLI port is configured
# in angular.json (serve.options.port). The script blocks here until Ctrl+C,
# at which point the trap above shuts down the mock server.
echo "[INFO] Starting Angular dev server on port 3000..."
echo ""
echo "  App:   http://localhost:3000"
echo "  Mocks: http://localhost:${MOCK_SERVER_PORT}"
echo "  Press Ctrl+C to stop all services"
echo ""

(cd "$IMPL_DIR" && pnpm dev)
