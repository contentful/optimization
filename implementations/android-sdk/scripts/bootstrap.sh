#!/usr/bin/env bash
#
# bootstrap.sh - Build, install, and launch the Android reference implementation
#
# This script orchestrates the complete local development workflow by:
#   1. Ensuring a device/emulator is available (uses running device, starts an
#      existing AVD, or creates a Pixel 7 API 35 AVD as a last resort)
#   2. Starting the mock API server (from lib/mocks)
#   3. Setting up adb reverse port forwarding so the emulator can reach localhost
#   4. Building the Android app (via Gradle)
#   5. Installing the APK on the connected emulator/device
#   6. Launching the app
#   7. Cleaning up the mock server and emulator on exit
#
# Environment Variables:
#   MOCK_SERVER_PORT  - Port for mock API server (default: 8000)
#   SKIP_BUILD        - Set to "true" to skip the Gradle build step (default: false)
#
# Prerequisites:
#   - Android SDK installed with ANDROID_HOME set
#   - pnpm dependencies installed at monorepo root
#   - Android bridge built: pnpm --filter @contentful/optimization-android-bridge build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
SKIP_BUILD="${SKIP_BUILD:-false}"
MOCK_SERVER_PID=""
EMULATOR_PID=""

LOG_DIR="${APP_DIR}/logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
    log_info "Cleaning up..."
    if [[ -n "$MOCK_SERVER_PID" ]] && kill -0 "$MOCK_SERVER_PID" 2>/dev/null; then
        log_info "Stopping mock server (PID: $MOCK_SERVER_PID)..."
        kill "$MOCK_SERVER_PID" 2>/dev/null || true
        wait "$MOCK_SERVER_PID" 2>/dev/null || true
    fi
    if [[ -n "$EMULATOR_PID" ]] && kill -0 "$EMULATOR_PID" 2>/dev/null; then
        log_info "Stopping emulator (PID: $EMULATOR_PID)..."
        kill "$EMULATOR_PID" 2>/dev/null || true
        wait "$EMULATOR_PID" 2>/dev/null || true
    fi
    log_info "Cleanup complete"
}

trap cleanup EXIT INT TERM

wait_for_port() {
    local port="$1"
    local name="$2"
    local max_attempts="${3:-30}"
    local attempt=1

    log_info "Waiting for $name on port $port..."

    while [[ $attempt -le $max_attempts ]]; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_info "$name is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    echo ""
    log_error "$name did not start after $max_attempts seconds"
    return 1
}

ensure_device() {
    if ! command -v adb &>/dev/null; then
        log_error "adb not found. Install Android SDK and ensure adb is in PATH."
        exit 1
    fi

    if adb devices | grep -q "device$"; then
        log_info "Android device already running"
        return 0
    fi

    local emulator_bin="${ANDROID_HOME:-}/emulator/emulator"
    if [[ ! -x "$emulator_bin" ]]; then
        emulator_bin="$(command -v emulator 2>/dev/null || true)"
    fi
    if [[ -z "$emulator_bin" ]]; then
        log_error "emulator not found. Set ANDROID_HOME or add emulator to PATH."
        exit 1
    fi

    local avd
    avd=$("$emulator_bin" -list-avds 2>/dev/null | head -n1)

    if [[ -z "$avd" ]]; then
        log_info "No AVDs found. Creating one..."
        create_avd
        avd=$("$emulator_bin" -list-avds 2>/dev/null | head -n1)
    fi

    log_info "Starting emulator: $avd"
    "$emulator_bin" -avd "$avd" -no-snapshot-load &
    EMULATOR_PID=$!

    log_info "Waiting for emulator to boot..."
    adb wait-for-device
    local boot=""
    while [[ "$boot" != "1" ]]; do
        sleep 2
        boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    done
    log_info "Emulator booted"
}

create_avd() {
    local sdkmanager="${ANDROID_HOME:-}/cmdline-tools/latest/bin/sdkmanager"
    if [[ ! -x "$sdkmanager" ]]; then
        sdkmanager="$(command -v sdkmanager 2>/dev/null || true)"
    fi
    if [[ -z "$sdkmanager" ]]; then
        log_error "sdkmanager not found. Install Android SDK command-line tools."
        exit 1
    fi

    local sys_image="system-images;android-35;google_apis;arm64-v8a"
    log_info "Installing system image: $sys_image"
    yes | "$sdkmanager" --install "$sys_image" "platforms;android-35" >/dev/null 2>&1 || true

    local avdmanager="${ANDROID_HOME:-}/cmdline-tools/latest/bin/avdmanager"
    if [[ ! -x "$avdmanager" ]]; then
        avdmanager="$(command -v avdmanager 2>/dev/null || true)"
    fi
    if [[ -z "$avdmanager" ]]; then
        log_error "avdmanager not found. Install Android SDK command-line tools."
        exit 1
    fi

    log_info "Creating AVD: Pixel_7_API_35"
    echo "no" | "$avdmanager" create avd \
        --name "Pixel_7_API_35" \
        --package "$sys_image" \
        --device "pixel_7"
    log_info "AVD created"
}

start_mock_server() {
    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."

    mkdir -p "$LOG_DIR"

    if lsof -ti:"${MOCK_SERVER_PORT}" >/dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} already in use. Killing existing process..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    pnpm --dir "$ROOT_DIR/lib/mocks" serve >"$LOG_DIR/mock-server.log" 2>&1 &
    MOCK_SERVER_PID=$!

    if ! wait_for_port "${MOCK_SERVER_PORT}" "Mock server" 30; then
        log_error "Mock server failed to start. Logs:"
        cat "$LOG_DIR/mock-server.log"
        exit 1
    fi
}

setup_adb_reverse() {
    log_info "Setting up adb reverse port forwarding..."
    adb reverse tcp:${MOCK_SERVER_PORT} tcp:${MOCK_SERVER_PORT}
    log_info "Port ${MOCK_SERVER_PORT} forwarded to emulator"
}

build_app() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi

    log_info "Building Android app..."
    cd "$APP_DIR"
    ./gradlew :app:assembleDebug
    log_info "Build complete"
}

install_and_launch() {
    local apk="$APP_DIR/app/build/outputs/apk/debug/app-debug.apk"

    if [[ ! -f "$apk" ]]; then
        log_error "APK not found at $apk. Did the build succeed?"
        exit 1
    fi

    log_info "Installing APK..."
    adb install -r "$apk"

    log_info "Launching app..."
    adb shell am start -n com.contentful.optimization.app/.MainActivity

    log_info "App launched successfully"
}

main() {
    log_info "=== Android Reference App Bootstrap ==="
    log_info "Root: $ROOT_DIR"
    log_info "App: $APP_DIR"

    ensure_device
    start_mock_server
    setup_adb_reverse
    build_app
    install_and_launch

    log_info "=== Bootstrap complete ==="
    log_info "Mock server running in background (PID: $MOCK_SERVER_PID)"
    log_info "Press Ctrl+C to stop the mock server and exit"
    wait
}

main "$@"
