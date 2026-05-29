#!/usr/bin/env bash
#
# run-e2e.sh - Android Maestro E2E Test Runner
#
# This script orchestrates the complete Android E2E testing workflow by:
#   1. Ensuring a visible emulator is running (auto-launches one if none connected)
#   2. Starting the mock API server (from lib/mocks)
#   3. Setting up adb reverse port forwarding so the emulator can reach localhost
#   4. Disabling emulator animations for reliable UI timing
#   5. Building both reference app APKs (compose + views) via Gradle
#   6. Installing the app APK(s) on the connected device/emulator
#   7. Running the Maestro flow suite (maestro/) against each target app via the
#      same single flow set, parameterized by `appId: ${APP_ID}` — the Compose and
#      XML Views apps are driven by identical flows (mirrors the iOS paradigm)
#   8. Cleaning up all background processes on exit
#
# The Maestro flows replace the retired UiAutomator `uitests` suite: Maestro's
# built-in auto-waiting and scrollUntilVisible remove the hand-rolled polling that
# made the instrumentation suite flaky.
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
#   APP_PACKAGE       - Which app(s) to drive: "all"/"both"/"" (default) runs Compose then
#                       Views; a single package value drives just that app.
#   MAESTRO_ITERATIONS - Repeat the full run N times to measure flakiness (default: 1)
#   CI                - Set to "true" when running in CI environment (default: false)
#
# Usage:
#   ./scripts/run-e2e.sh                                 # Build + run all flows on both apps
#   SKIP_BUILD=true ./scripts/run-e2e.sh                 # Skip the Gradle build step
#   ./scripts/run-e2e.sh --flow preview-panel            # Run only the maestro/preview-panel flows
#   APP_PACKAGE=com.contentful.optimization.app.views ./scripts/run-e2e.sh   # Views only
#   MAESTRO_ITERATIONS=10 ./scripts/run-e2e.sh           # Flake sweep
#
# Prerequisites:
#   - Android SDK installed with adb and emulator in PATH (or ANDROID_HOME set)
#   - At least one AVD configured (or a physical device connected)
#   - Maestro CLI installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - pnpm dependencies installed at monorepo root
#   - Android bridge built: pnpm --filter @contentful/optimization-js-bridge build
#
# Logs:
#   Mock server output is written to implementations/android-sdk/logs/mock-server.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

LOG_DIR="${APP_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
MOCK_SERVER_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
SKIP_BUILD="${SKIP_BUILD:-false}"
CI="${CI:-false}"
DISABLE_EMULATOR_ANIMATIONS="${DISABLE_EMULATOR_ANIMATIONS:-true}"
STREAM_BACKGROUND_LOGS="${STREAM_BACKGROUND_LOGS:-false}"
MAESTRO_ITERATIONS="${MAESTRO_ITERATIONS:-1}"
# Attempts per app before declaring failure. Maestro 2.x has no --retries flag, and a
# long emulator session occasionally drops a single flow (adb/gRPC hiccup or a slow
# re-resolution late in the run). One retry of the app's suite lets that self-heal; a
# genuine failure still fails every attempt. Set to 1 to disable retries.
MAESTRO_ATTEMPTS="${MAESTRO_ATTEMPTS:-2}"

# AVD pinned to match the CI emulator-runner config in
# .github/workflows/main-pipeline.yaml (e2e-android-maestro):
#   profile=pixel_7, api-level=35, target=google_apis
# The only intentional difference is CPU arch: local uses arm64-v8a for native
# speed on Apple Silicon; CI uses x86_64 because Namespace's KVM-backed Android
# emulator support is linux/amd64-only.
EMULATOR_AVD="${EMULATOR_AVD:-pixel_7_api35_e2e}"

# Subdirectory of maestro/ to run; empty means the whole suite.
FLOW_SUBPATH=""

# APP_PACKAGE selects which reference implementation(s) to drive. When unset (or set to
# "all"/"both"), the script runs the suite against both the Compose and XML Views apps,
# mirroring the CI job in main-pipeline.yaml.
APP_PACKAGE="${APP_PACKAGE:-all}"

COMPOSE_PACKAGE="com.contentful.optimization.app"
VIEWS_PACKAGE="com.contentful.optimization.app.views"

MAESTRO_BIN=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Run Android Maestro E2E flows against the reference apps.

Options:
  --flow SUBPATH    Run only the flows under maestro/SUBPATH (e.g. preview-panel)
  --skip-build      Skip the Gradle build step
  -h, --help        Show this help message

Environment Variables:
  MOCK_SERVER_PORT    Port for mock server (default: 8000)
  SKIP_BUILD          Set to 'true' to skip build (default: false)
  DISABLE_EMULATOR_ANIMATIONS Set to 'false' to keep emulator animations (default: true)
  STREAM_BACKGROUND_LOGS Set to 'true' to stream mock server logs to stdout (default: false)
  EMULATOR_AVD        AVD name to require/auto-launch (default: pixel_7_api35_e2e)
  APP_PACKAGE         all|both|<single package> (default: all)
  MAESTRO_ITERATIONS  Repeat the full run N times (default: 1)
  CI                  Set to 'true' for CI mode (default: false)

Examples:
  $(basename "$0")                                  # All flows, both apps
  $(basename "$0") --flow preview-panel             # One suite, both apps
  APP_PACKAGE=$VIEWS_PACKAGE $(basename "$0")        # Views only
  SKIP_BUILD=true $(basename "$0")                   # Skip build
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --flow)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires a subpath argument"
                    usage
                    exit 1
                fi
                FLOW_SUBPATH="$2"
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
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

resolve_maestro_bin() {
    if command -v maestro &>/dev/null; then
        MAESTRO_BIN="$(command -v maestro)"
        return 0
    fi
    if [[ -x "$HOME/.maestro/bin/maestro" ]]; then
        MAESTRO_BIN="$HOME/.maestro/bin/maestro"
        return 0
    fi
    log_error "maestro not found. Install it with:"
    log_error '  curl -Ls "https://get.maestro.mobile.dev" | bash'
    exit 1
}

module_for_package() {
    case "$1" in
        "$COMPOSE_PACKAGE") echo "compose" ;;
        "$VIEWS_PACKAGE") echo "views" ;;
        *)
            log_error "Unknown APP_PACKAGE: $1. Expected $COMPOSE_PACKAGE or $VIEWS_PACKAGE."
            exit 1
            ;;
    esac
}

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
        PORT="$MOCK_SERVER_PORT" pnpm --dir "$ROOT_DIR/lib/mocks" serve 2>&1 | tee "$MOCK_SERVER_LOG" &
    else
        PORT="$MOCK_SERVER_PORT" pnpm --dir "$ROOT_DIR/lib/mocks" serve > "$MOCK_SERVER_LOG" 2>&1 &
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
        log_info "Disabling emulator animations for reliable UI timing..."
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
    pnpm --dir "$ROOT_DIR" --filter @contentful/optimization-js-bridge build
    log_info "Bridge bundle built"
}

build_apks() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi

    # Build both reference app APKs. Maestro is external (black-box) and needs no
    # separate test APK.
    log_info "Building compose and views APKs..."
    cd "$APP_DIR"
    ./gradlew :compose:assembleDebug :views:assembleDebug
    log_info "Build complete"
}

install_app() {
    local package="$1"
    local module
    module="$(module_for_package "$package")"
    local app_apk="$APP_DIR/$module/build/outputs/apk/debug/${module}-debug.apk"

    if [[ ! -f "$app_apk" ]]; then
        log_error "App APK not found at $app_apk. Did the build succeed?"
        exit 1
    fi

    log_info "Installing $module APK ($package)..."
    adb install -r "$app_apk"
}

run_maestro_for_app() {
    local package="$1"
    local flows_dir="$APP_DIR/maestro"
    if [[ -n "$FLOW_SUBPATH" ]]; then
        flows_dir="$flows_dir/$FLOW_SUBPATH"
    fi

    if [[ ! -e "$flows_dir" ]]; then
        log_error "Maestro flows path not found: $flows_dir"
        exit 1
    fi

    local attempt
    for ((attempt = 1; attempt <= MAESTRO_ATTEMPTS; attempt++)); do
        if [[ "$attempt" -gt 1 ]]; then
            log_warn "Retry $attempt/$MAESTRO_ATTEMPTS for $package (a flow failed on the previous attempt)..."
        else
            log_info "--- Running Maestro flows against $package ---"
        fi
        if "$MAESTRO_BIN" test -e "APP_ID=$package" "$flows_dir"; then
            return 0
        fi
    done
    log_error "Maestro flows failed for $package after $MAESTRO_ATTEMPTS attempt(s)"
    return 1
}

main() {
    parse_args "$@"

    local apps_to_run=()
    case "$APP_PACKAGE" in
        all|both|"")
            apps_to_run=("$COMPOSE_PACKAGE" "$VIEWS_PACKAGE")
            ;;
        *)
            module_for_package "$APP_PACKAGE" >/dev/null
            apps_to_run=("$APP_PACKAGE")
            ;;
    esac

    log_info "=== Android Maestro E2E Test Runner ==="
    log_info "Root directory: $ROOT_DIR"
    log_info "App directory: $APP_DIR"
    log_info "Target apps: ${apps_to_run[*]}"
    log_info "Flows: maestro/${FLOW_SUBPATH:-(all)}"
    log_info "Iterations: $MAESTRO_ITERATIONS"
    log_info "CI mode: $CI"

    resolve_maestro_bin
    verify_device
    start_mock_server
    setup_adb
    build_bridge
    build_apks

    # Install every target app up front so a single emulator can drive both.
    for package in "${apps_to_run[@]}"; do
        install_app "$package"
    done

    local rc=0
    local iteration
    for ((iteration = 1; iteration <= MAESTRO_ITERATIONS; iteration++)); do
        if [[ "$MAESTRO_ITERATIONS" -gt 1 ]]; then
            log_info "=== iteration ${iteration}/${MAESTRO_ITERATIONS} ==="
        fi
        for package in "${apps_to_run[@]}"; do
            if ! run_maestro_for_app "$package"; then
                rc=1
            fi
        done
    done

    if [[ $rc -ne 0 ]]; then
        log_error "=== Maestro E2E completed with failures ==="
        exit $rc
    fi

    log_info "=== All Maestro flows passed ==="
}

main "$@"
