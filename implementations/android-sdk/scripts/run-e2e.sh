#!/usr/bin/env bash
#
# run-e2e.sh - Android UI Automator 2 E2E Test Runner
#
# This script orchestrates the complete Android E2E testing workflow by:
#   1. Starting the mock API server (from lib/mocks)
#   2. Ensuring a visible emulator is running (auto-launches one if none connected)
#   3. Setting up adb reverse port forwarding so the emulator can reach localhost
#   4. Disabling emulator animations for reliable UI test timing
#   5. Building the app APK and test APK (via Gradle)
#   6. Installing both APKs on the connected device/emulator
#   7. Running the UI Automator 2 instrumented test suite
#   8. Cleaning up all background processes on exit
#
# The emulator is always launched with a visible window. This script never
# starts a headless emulator (no `-no-window` flag) — by design.
#
# Environment Variables:
#   MOCK_SERVER_PORT  - Port for mock API server (default: 8000)
#   SKIP_BUILD        - Set to "true" to skip the Gradle build step (default: false)
#   DISABLE_EMULATOR_ANIMATIONS - Set to "false" to keep animation scales unchanged (default: true)
#   STREAM_BACKGROUND_LOGS - Set to "true" to stream mock server logs to stdout (default: false)
#   EMULATOR_AVD      - AVD to require/auto-launch (default: pixel_7_api35_e2e, pinned to match CI)
#   CI                - Set to "true" when running in CI environment (default: false)
#
# Usage:
#   ./scripts/run-e2e.sh                                    # Full run with build
#   SKIP_BUILD=true ./scripts/run-e2e.sh                    # Skip build step
#   ./scripts/run-e2e.sh --test-class AnalyticsTests        # Run a single test class
#   ./scripts/run-e2e.sh --test-class AnalyticsTests --test-method testTracksComponentImpressionEventsForVisibleEntries
#
# Prerequisites:
#   - Android SDK installed with adb and emulator in PATH (or ANDROID_HOME set)
#   - At least one AVD configured (or a physical device connected)
#   - pnpm dependencies installed at monorepo root
#   - Android bridge built: pnpm --filter @contentful/optimization-android-bridge build
#
# Logs:
#   All logs are written to implementations/android-sdk/logs/:
#     - mock-server.log  - Mock API server output
#     - test-results.log - E2E test execution results

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

LOG_DIR="${APP_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
TEST_LOG="${LOG_DIR}/test-results.log"
MOCK_SERVER_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
SKIP_BUILD="${SKIP_BUILD:-false}"
CI="${CI:-false}"
DISABLE_EMULATOR_ANIMATIONS="${DISABLE_EMULATOR_ANIMATIONS:-true}"
STREAM_BACKGROUND_LOGS="${STREAM_BACKGROUND_LOGS:-false}"

# AVD pinned to match the CI emulator-runner config in
# .github/workflows/main-pipeline.yaml (e2e-android-sdk):
#   profile=pixel_7, api-level=35, target=google_apis
# The only intentional difference is CPU arch: local uses arm64-v8a for native
# speed on Apple Silicon; CI uses x86_64 because Namespace's KVM-backed Android
# emulator support is linux/amd64-only.
EMULATOR_AVD="${EMULATOR_AVD:-pixel_7_api35_e2e}"

TEST_CLASS=""
TEST_METHOD=""

UITEST_PACKAGE="com.contentful.optimization.uitests.tests"
APP_PACKAGE="com.contentful.optimization.app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Run Android UI Automator 2 E2E tests.

Options:
  --test-class CLASS_NAME     Run only the specified test class (e.g., AnalyticsTests)
  --test-method METHOD_NAME   Run only the specified test method (requires --test-class)
  --skip-build                Skip the Gradle build step
  -h, --help                  Show this help message

Environment Variables:
  MOCK_SERVER_PORT    Port for mock server (default: 8000)
  SKIP_BUILD          Set to 'true' to skip build (default: false)
  DISABLE_EMULATOR_ANIMATIONS Set to 'false' to keep emulator animations enabled (default: true)
  STREAM_BACKGROUND_LOGS Set to 'true' to stream mock server logs to stdout (default: false)
  EMULATOR_AVD        AVD name to require/auto-launch (default: pixel_7_api35_e2e,
                      pinned to match CI; override only if you have a reason)
  CI                  Set to 'true' for CI mode (default: false)

Examples:
  $(basename "$0")                                                    # Run all tests
  $(basename "$0") --test-class AnalyticsTests                        # Run one test class
  $(basename "$0") --test-class AnalyticsTests --test-method testTracksComponentImpressionEventsForVisibleEntries
  SKIP_BUILD=true $(basename "$0")                                    # Skip build
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test-class)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires a class name argument"
                    usage
                    exit 1
                fi
                TEST_CLASS="$2"
                shift 2
                ;;
            --test-method)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires a method name argument"
                    usage
                    exit 1
                fi
                TEST_METHOD="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                log_error "Unexpected argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    if [[ -n "$TEST_METHOD" && -z "$TEST_CLASS" ]]; then
        log_error "--test-method requires --test-class"
        usage
        exit 1
    fi
}

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

stop_process_tree() {
    local pid="$1"
    local name="$2"
    local timeout_seconds="${3:-5}"
    local elapsed=0

    if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
        return 0
    fi

    log_info "Stopping ${name} (PID: ${pid})..."

    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true

    while kill -0 "$pid" 2>/dev/null && [[ $elapsed -lt $timeout_seconds ]]; do
        sleep 1
        ((elapsed++))
    done

    if kill -0 "$pid" 2>/dev/null; then
        log_warn "${name} did not stop within ${timeout_seconds}s; force killing..."
        pkill -KILL -P "$pid" 2>/dev/null || true
        kill -KILL "$pid" 2>/dev/null || true
    fi

    wait "$pid" 2>/dev/null || true
}

cleanup() {
    log_info "Cleaning up background processes..."

    if [[ -n "$MOCK_SERVER_PID" ]]; then
        stop_process_tree "$MOCK_SERVER_PID" "mock server" 8
    fi

    if lsof -ti:"${MOCK_SERVER_PORT}" > /dev/null 2>&1; then
        log_info "Killing any remaining processes on mock server port ${MOCK_SERVER_PORT}..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
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

find_emulator_binary() {
    if command -v emulator &>/dev/null; then
        command -v emulator
        return 0
    fi

    local sdk_root
    for sdk_root in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk"; do
        if [[ -n "$sdk_root" && -x "$sdk_root/emulator/emulator" ]]; then
            echo "$sdk_root/emulator/emulator"
            return 0
        fi
    done

    return 1
}

print_avd_setup_instructions() {
    cat <<EOF
  # Install the system image (arm64-v8a on Apple Silicon, x86_64 on Intel):
  sdkmanager --install "system-images;android-35;google_apis;arm64-v8a"

  # Create the AVD pinned to match CI:
  avdmanager create avd \\
      --name "${EMULATOR_AVD}" \\
      --package "system-images;android-35;google_apis;arm64-v8a" \\
      --device "pixel_7"

  # (Optional) override via env var if you need a different name:
  EMULATOR_AVD=other_name ./scripts/run-e2e.sh
EOF
}

start_visible_emulator() {
    local emulator_bin
    if ! emulator_bin="$(find_emulator_binary)"; then
        log_error "emulator binary not found. Install the Android SDK 'emulator' package or set ANDROID_HOME."
        exit 1
    fi

    local avds
    avds="$("$emulator_bin" -list-avds 2>/dev/null | grep -v '^$' || true)"

    if [[ -z "$avds" ]]; then
        log_error "No AVDs found. Create the CI-aligned AVD:"
        print_avd_setup_instructions
        exit 1
    fi

    if ! echo "$avds" | grep -qx "$EMULATOR_AVD"; then
        log_error "AVD '$EMULATOR_AVD' not found. This script pins the AVD to match CI so local results"
        log_error "track CI results. Available AVDs on this machine:"
        echo "$avds" | sed 's/^/    /'
        log_error "Create the CI-aligned AVD:"
        print_avd_setup_instructions
        exit 1
    fi

    mkdir -p "$LOG_DIR"
    log_info "Launching emulator with AVD '$EMULATOR_AVD' (visible window)..."
    # IMPORTANT: never pass -no-window. This script requires a visible emulator.
    # Do NOT use `nohup` here — on macOS it detaches the process from the
    # session that provides the display server connection, and the emulator
    # window will silently fail to appear. Plain `&` keeps the GUI working;
    # `disown` keeps the emulator alive after this script exits.
    # The emulator binary expects to be invoked from its own SDK directory.
    (
        cd "$(dirname "$emulator_bin")"
        ./emulator -avd "$EMULATOR_AVD" > "$LOG_DIR/emulator.log" 2>&1 &
        disown
    )
    log_info "Emulator launch initiated; logs: $LOG_DIR/emulator.log"
}

wait_for_emulator_boot() {
    local max_attempts="${1:-180}"
    local attempt=0

    log_info "Waiting for emulator to register with adb..."
    if ! adb wait-for-device; then
        log_error "adb wait-for-device failed"
        exit 1
    fi

    log_info "Waiting for emulator boot to complete..."
    while [[ $attempt -lt $max_attempts ]]; do
        local boot_completed
        boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
        if [[ "$boot_completed" == "1" ]]; then
            echo ""
            log_info "Emulator boot complete"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    log_error "Emulator did not finish booting after $((max_attempts * 2)) seconds"
    exit 1
}

list_headless_qemu_pids() {
    # An Android emulator is "headless" when EITHER of these is true:
    #   - it is running the `qemu-system-*-headless` binary
    #   - its command line contains `-no-window`
    # Walk every qemu-system process and emit the PIDs of those that match.
    local pid cmd
    while IFS= read -r pid; do
        [[ -z "$pid" ]] && continue
        cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
        if [[ "$cmd" == *"headless"* || "$cmd" == *"-no-window"* ]]; then
            echo "$pid"
        fi
    done < <(pgrep -f 'qemu-system' 2>/dev/null || true)
}

kill_headless_emulators() {
    local pids
    pids="$(list_headless_qemu_pids)"
    if [[ -z "$pids" ]]; then
        return 0
    fi

    log_warn "Detected headless emulator process(es). Killing them — this script requires a visible window:"
    # shellcheck disable=SC2086
    ps -o pid=,command= -p $pids 2>/dev/null | sed 's/^/  /' || true

    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null || true
    sleep 2

    pids="$(list_headless_qemu_pids)"
    if [[ -n "$pids" ]]; then
        log_warn "Force-killing stubborn headless emulator(s)..."
        # shellcheck disable=SC2086
        kill -KILL $pids 2>/dev/null || true
        sleep 1
    fi

    # adb keeps a stale connection to the killed emulator-5554 device entry;
    # bouncing the server flushes it so a fresh visible launch can take that slot.
    log_info "Restarting adb server to drop stale headless-emulator device entry..."
    adb kill-server >/dev/null 2>&1 || true
    adb start-server >/dev/null 2>&1 || true
    sleep 1
}

connected_emulator_avd_name() {
    # Returns the AVD name of the first ready emulator-XXXX device, or empty string.
    local serial
    serial="$(adb devices 2>/dev/null | awk '/^emulator-[0-9]+\tdevice$/ {print $1; exit}')"
    if [[ -z "$serial" ]]; then
        return 0
    fi
    # `adb emu avd name` prints two lines: the AVD name, then "OK".
    adb -s "$serial" emu avd name 2>/dev/null | head -n1 | tr -d '\r' || true
}

verify_device() {
    if ! command -v adb &>/dev/null; then
        log_error "adb not found. Install Android SDK and ensure adb is in PATH."
        exit 1
    fi

    kill_headless_emulators

    if adb devices | grep -q "device$"; then
        local current_avd
        current_avd="$(connected_emulator_avd_name)"
        if [[ -z "$current_avd" || "$current_avd" == "$EMULATOR_AVD" ]]; then
            # Physical device (no AVD name) is fine; pinned AVD is fine.
            log_info "Android device detected${current_avd:+ (AVD: $current_avd)}"
            return 0
        fi

        log_error "A connected emulator is running AVD '$current_avd', but this script"
        log_error "pins to '$EMULATOR_AVD' so local results track CI results."
        log_error ""
        log_error "Either stop the other emulator (e.g. via its window or 'adb -s emulator-XXXX emu kill')"
        log_error "and re-run, or override the pin with: EMULATOR_AVD=$current_avd ./scripts/run-e2e.sh"
        exit 1
    fi

    log_warn "No Android device connected. Auto-launching a visible emulator..."
    start_visible_emulator
    wait_for_emulator_boot

    if ! adb devices | grep -q "device$"; then
        log_error "Emulator booted but adb still does not see a 'device' entry"
        exit 1
    fi

    log_info "Emulator is ready"
}

start_mock_server() {
    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."

    mkdir -p "$LOG_DIR"

    if lsof -ti:"${MOCK_SERVER_PORT}" >/dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} already in use. Killing existing process..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    if [[ "$STREAM_BACKGROUND_LOGS" == "true" ]]; then
        pnpm --dir "$ROOT_DIR/lib/mocks" serve 2>&1 | tee "$MOCK_SERVER_LOG" &
    else
        pnpm --dir "$ROOT_DIR/lib/mocks" serve > "$MOCK_SERVER_LOG" 2>&1 &
    fi
    MOCK_SERVER_PID=$!

    log_info "Mock server started with PID: $MOCK_SERVER_PID"

    if ! wait_for_port "${MOCK_SERVER_PORT}" "Mock server" 30; then
        log_error "Mock server failed to start. Logs:"
        cat "$MOCK_SERVER_LOG"
        exit 1
    fi
}

setup_adb() {
    log_info "Setting up adb reverse port forwarding..."
    adb reverse tcp:${MOCK_SERVER_PORT} tcp:${MOCK_SERVER_PORT}
    log_info "Port ${MOCK_SERVER_PORT} forwarded to emulator"

    if [[ "$DISABLE_EMULATOR_ANIMATIONS" == "true" ]]; then
        log_info "Disabling emulator animations for reliable UI test timing..."
        for animation_scale in window_animation_scale transition_animation_scale animator_duration_scale; do
            if adb shell settings put global "${animation_scale}" 0 > /dev/null 2>&1; then
                log_info "Set ${animation_scale}=0"
            else
                log_warn "Could not set ${animation_scale}=0; continuing"
            fi
        done
    fi
}

build_bridge() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        return 0
    fi

    log_info "Building Android bridge JS bundle..."
    pnpm --dir "$ROOT_DIR" --filter @contentful/optimization-android-bridge build
    log_info "Bridge bundle built"
}

build_apks() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi

    log_info "Building app APK and test APK..."
    cd "$APP_DIR"
    ./gradlew :app:assembleDebug :uitests:assembleDebug
    log_info "Build complete"
}

install_apks() {
    local app_apk="$APP_DIR/app/build/outputs/apk/debug/app-debug.apk"
    local test_apk="$APP_DIR/uitests/build/outputs/apk/debug/uitests-debug.apk"

    if [[ ! -f "$app_apk" ]]; then
        log_error "App APK not found at $app_apk. Did the build succeed?"
        exit 1
    fi

    if [[ ! -f "$test_apk" ]]; then
        log_error "Test APK not found at $test_apk. Did the build succeed?"
        exit 1
    fi

    log_info "Installing app APK..."
    adb install -r "$app_apk"

    log_info "Installing test APK..."
    adb install -r "$test_apk"

    log_info "Both APKs installed"
}

run_tests() {
    log_info "Running UI Automator 2 E2E tests..."

    mkdir -p "$LOG_DIR"

    local am_args="-w"

    if [[ -n "$TEST_CLASS" ]]; then
        local full_class="${UITEST_PACKAGE}.${TEST_CLASS}"
        if [[ -n "$TEST_METHOD" ]]; then
            am_args="$am_args -e class ${full_class}#${TEST_METHOD}"
            log_info "Running: ${TEST_CLASS}#${TEST_METHOD}"
        else
            am_args="$am_args -e class ${full_class}"
            log_info "Running: ${TEST_CLASS}"
        fi
    else
        log_info "Running all test classes"
    fi

    local test_runner="com.contentful.optimization.uitests/androidx.test.runner.AndroidJUnitRunner"

    set +e
    adb shell am instrument $am_args "$test_runner" 2>&1 | tee "$TEST_LOG"
    local test_exit_code="${PIPESTATUS[0]}"
    set -e

    if grep -q "Process crashed" "$TEST_LOG" 2>/dev/null; then
        log_error "Test process CRASHED. Check results in: $TEST_LOG"
        exit 1
    fi

    if grep -q "FAILURES\!\!\!" "$TEST_LOG" 2>/dev/null; then
        log_error "Some tests FAILED. Check results in: $TEST_LOG"
        exit 1
    fi

    if grep -q "INSTRUMENTATION_CODE: 0" "$TEST_LOG" 2>/dev/null && ! grep -q "OK (" "$TEST_LOG" 2>/dev/null; then
        log_error "Instrumentation exited abnormally. Check results in: $TEST_LOG"
        exit 1
    fi

    if grep -q "OK (" "$TEST_LOG" 2>/dev/null; then
        log_info "All tests passed!"
    elif [[ $test_exit_code -ne 0 ]]; then
        log_error "Test runner exited with code $test_exit_code. Check results in: $TEST_LOG"
        exit $test_exit_code
    fi
}

main() {
    parse_args "$@"

    log_info "=== Android UI Automator 2 E2E Test Runner ==="
    log_info "Root directory: $ROOT_DIR"
    log_info "App directory: $APP_DIR"
    log_info "CI mode: $CI"
    [[ -n "$TEST_CLASS" ]] && log_info "Test class: $TEST_CLASS"
    [[ -n "$TEST_METHOD" ]] && log_info "Test method: $TEST_METHOD"

    verify_device
    start_mock_server
    setup_adb
    build_bridge
    build_apks
    install_apks
    run_tests

    log_info "=== All tests completed successfully ==="
}

main "$@"
