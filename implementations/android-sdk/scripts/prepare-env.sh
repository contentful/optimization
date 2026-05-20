#!/usr/bin/env bash
#
# prepare-env.sh — Pre-launch check for Android Studio app/test runs.
#
# Verifies the runtime preconditions that the app and UI Automator tests
# need, then sets up `adb reverse` so the emulator can reach localhost:
#   1. Mock API server is listening on $MOCK_SERVER_PORT (default 8000)
#   2. Android bridge JS bundle has been built
#   3. An emulator/device is connected via adb
#   4. adb reverse is set so the device can reach the host mock server
#
# This script does NOT auto-start the mock server. If it is missing, the
# script exits non-zero and prints the command to start it. Keep the mock
# running in a separate terminal (or run ./scripts/bootstrap.sh) before
# launching from Android Studio.
#
# Wired up as a "Before launch" task on the "App" and "All UI Tests" run
# configurations in .idea/runConfigurations/.
#
# Environment Variables:
#   MOCK_SERVER_PORT  - Port the mock server is expected on (default: 8000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

check_mock_server() {
    if nc -z localhost "$MOCK_SERVER_PORT" 2>/dev/null; then
        log_info "Mock server reachable on localhost:${MOCK_SERVER_PORT}"
        return 0
    fi

    log_error "Mock server is not running on port ${MOCK_SERVER_PORT}."
    log_error ""
    log_error "Start it in a separate terminal from the monorepo root:"
    log_error "  pnpm --dir lib/mocks serve"
    log_error ""
    log_error "Or use the bootstrap script to launch mock + app together:"
    log_error "  ./scripts/bootstrap.sh"
    return 1
}

check_bridge_bundle() {
    local bridge="${ROOT_DIR}/packages/android/ContentfulOptimization/src/main/assets/optimization-android-bridge.umd.js"
    if [[ -f "$bridge" ]]; then
        log_info "Android bridge bundle present"
        return 0
    fi

    log_error "Android bridge bundle missing at:"
    log_error "  ${bridge}"
    log_error ""
    log_error "Build it from the monorepo root:"
    log_error "  pnpm --filter @contentful/optimization-js-bridge build"
    return 1
}

check_adb() {
    if command -v adb &>/dev/null; then
        return 0
    fi

    log_error "adb not found in PATH."
    log_error "Install Android SDK platform-tools and ensure adb is on PATH."
    return 1
}

check_device() {
    if adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
        return 0
    fi

    log_error "No connected emulator/device detected."
    log_error "Start an AVD from Android Studio (Device Manager) or run:"
    log_error "  \$ANDROID_HOME/emulator/emulator -avd <avd-name>"
    return 1
}

setup_adb_reverse() {
    adb reverse tcp:"${MOCK_SERVER_PORT}" tcp:"${MOCK_SERVER_PORT}" >/dev/null
    log_info "adb reverse tcp:${MOCK_SERVER_PORT} tcp:${MOCK_SERVER_PORT} set"
}

main() {
    check_mock_server
    check_bridge_bundle
    check_adb
    check_device
    setup_adb_reverse
    log_info "Environment ready for Android Studio."
}

main "$@"
