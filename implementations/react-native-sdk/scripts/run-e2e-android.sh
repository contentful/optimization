#!/usr/bin/env bash
#
# run-e2e-android.sh - One-shot Android E2E Test Runner
#
# This script orchestrates the complete Android E2E testing workflow by:
#   1. Creating a .env file from .env.example
#   2. Starting the mock API server (from lib/mocks)
#   3. Starting the Metro bundler for React Native
#   4. Setting up adb reverse port forwarding so the emulator can reach localhost
#   5. Building the Android app (via Detox)
#   6. Running the E2E test suite
#   7. Cleaning up all background processes on exit
#
# Environment Variables:
#   MOCK_SERVER_PORT  - Port for mock API server (default: 8000)
#   METRO_PORT        - Port for Metro bundler (default: 8081)
#   SKIP_BUILD        - Set to "true" to skip the Android build step (default: false)
#   METRO_VERBOSE     - Set to "true" to run Metro with --verbose logging (default: false)
#   ENABLE_DEVICE_LOGCAT - Set to "true" to stream adb logcat during tests (default: false)
#   DISABLE_EMULATOR_ANIMATIONS - Set to "false" to keep animation scales unchanged (default: true)
#   STREAM_BACKGROUND_LOGS - Set to "true" to stream mock/Metro logs to stdout (default: false)
#   CI                - Set to "true" when running in CI environment (default: false)
#   PUBLIC_*           - Optional overrides for values loaded from .env.example
#
# Usage:
#   ./scripts/run-e2e-android.sh              # Full run with build
#   SKIP_BUILD=true ./scripts/run-e2e-android.sh  # Skip build step
#
# Prerequisites:
#   - Android emulator running (or will be started by CI action)
#   - Android SDK installed with adb in PATH
#   - pnpm dependencies installed at monorepo root
#
# Logs:
#   All logs are written to implementations/react-native-sdk/logs/:
#     - mock-server.log  - Mock API server output
#     - metro.log        - Metro bundler output
#     - device.log       - Android device logcat output
#     - test-results.log - E2E test execution results (pass/fail status)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$RN_DIR/../.." && pwd)"

LOG_DIR="${RN_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
METRO_LOG="${LOG_DIR}/metro.log"
DEVICE_LOG="${LOG_DIR}/device.log"
TEST_LOG="${LOG_DIR}/test-results.log"
MOCK_SERVER_PID=""
METRO_PID=""
LOGCAT_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
METRO_PORT="${METRO_PORT:-8081}"
SKIP_BUILD="${SKIP_BUILD:-false}"
CI="${CI:-false}"
METRO_VERBOSE="${METRO_VERBOSE:-false}"
ENABLE_DEVICE_LOGCAT="${ENABLE_DEVICE_LOGCAT:-false}"
DISABLE_EMULATOR_ANIMATIONS="${DISABLE_EMULATOR_ANIMATIONS:-true}"
STREAM_BACKGROUND_LOGS="${STREAM_BACKGROUND_LOGS:-false}"

TEST_FILE=""
TEST_NAME_PATTERN=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [TEST_FILE]

Run React Native Android E2E tests with Detox.

Arguments:
  TEST_FILE              Path to a specific test file to run (e.g., e2e/my-test.test.js)

Options:
  --test-file TEST_FILE           Run only the specified test file
  -t, --testNamePattern PATTERN   Run only tests matching the given pattern
  --skip-build                    Skip the Android build step
  -h, --help                      Show this help message

Environment Variables:
  MOCK_SERVER_PORT    Port for mock server (default: 8000)
  METRO_PORT          Port for Metro bundler (default: 8081)
  SKIP_BUILD          Set to 'true' to skip build (default: false)
  METRO_VERBOSE       Set to 'true' to run Metro with --verbose logging (default: false)
  ENABLE_DEVICE_LOGCAT Set to 'true' to stream adb logcat output (default: false)
  DISABLE_EMULATOR_ANIMATIONS Set to 'false' to keep emulator animations enabled (default: true)
  STREAM_BACKGROUND_LOGS Set to 'true' to stream mock/Metro logs to stdout (default: false)
  CI                  Set to 'true' for CI mode (default: false)

Examples:
  $(basename "$0")                                           # Run all tests
  $(basename "$0") e2e/my-test.test.js                       # Run specific test file
  $(basename "$0") --test-file e2e/my-test.test.js           # Run specific test file
  $(basename "$0") -t "should display variant"               # Run tests matching pattern
  $(basename "$0") e2e/my-test.test.js -t "should display"   # Combine file and pattern
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --test-file)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires a test file argument"
                    usage
                    exit 1
                fi
                if [[ -n "$TEST_FILE" ]]; then
                    log_error "Multiple test files not supported. Got: $TEST_FILE and $2"
                    usage
                    exit 1
                fi
                TEST_FILE="$2"
                shift 2
                ;;
            -t|--testNamePattern)
                if [[ -z "${2:-}" ]]; then
                    log_error "Option $1 requires a pattern argument"
                    usage
                    exit 1
                fi
                TEST_NAME_PATTERN="$2"
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
                if [[ -z "$TEST_FILE" ]]; then
                    TEST_FILE="$1"
                else
                    log_error "Multiple test files not supported. Got: $TEST_FILE and $1"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
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

    # Attempt graceful shutdown first.
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
    
    if [[ -n "$LOGCAT_PID" ]]; then
        stop_process_tree "$LOGCAT_PID" "adb logcat" 3
    fi
    
    if [[ -n "$METRO_PID" ]]; then
        stop_process_tree "$METRO_PID" "Metro bundler" 8
    fi
    
    if lsof -ti:"${METRO_PORT}" > /dev/null 2>&1; then
        log_info "Killing any remaining processes on Metro port ${METRO_PORT}..."
        lsof -ti:"${METRO_PORT}" | xargs kill -9 2>/dev/null || true
    fi
    
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

wait_for_service() {
    local url="$1"
    local name="$2"
    local max_attempts="${3:-30}"
    local attempt=1
    
    log_info "Waiting for $name to be ready at $url..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_info "$name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        ((attempt++))
    done
    
    echo ""
    log_error "$name did not become ready after $max_attempts seconds"
    return 1
}

wait_for_port() {
    local port="$1"
    local name="$2"
    local max_attempts="${3:-30}"
    local attempt=1
    
    log_info "Waiting for $name to be ready on port $port..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_info "$name is ready on port $port!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        ((attempt++))
    done
    
    echo ""
    log_error "$name did not become ready on port $port after $max_attempts seconds"
    return 1
}

wait_for_metro_ready() {
    local port="$1"
    local max_attempts="${2:-60}"
    local attempt=1
    local status_url="http://localhost:${port}/status"

    log_info "Waiting for Metro status endpoint to report ready..."

    while [[ $attempt -le $max_attempts ]]; do
        local response=""
        response="$(curl -fsS "$status_url" 2>/dev/null || true)"

        if [[ "$response" == "packager-status:running" ]]; then
            log_info "Metro status is ready"
            return 0
        fi

        echo -n "."
        sleep 1
        ((attempt++))
    done

    echo ""
    log_error "Metro status endpoint did not report ready after $max_attempts seconds"
    return 1
}

append_env_override() {
    local key="$1"
    local value="${2:-}"

    if [[ -z "$value" ]]; then
        return 0
    fi

    printf '%s="%s"\n' "$key" "$value" >> "${RN_DIR}/.env"
}

create_env_file() {
    local env_template="${RN_DIR}/.env.example"

    log_info "Creating .env file from .env.example..."

    if [[ ! -f "$env_template" ]]; then
        log_error "Missing env template: ${env_template}"
        exit 1
    fi

    cp "$env_template" "${RN_DIR}/.env"

    # Keep API endpoints and host aligned with the selected mock server port.
    append_env_override "PUBLIC_EXPERIENCE_API_BASE_URL" "http://localhost:${MOCK_SERVER_PORT}/experience/"
    append_env_override "PUBLIC_INSIGHTS_API_BASE_URL" "http://localhost:${MOCK_SERVER_PORT}/insights/"
    append_env_override "PUBLIC_CONTENTFUL_CDA_HOST" "localhost:${MOCK_SERVER_PORT}"

    # Allow optional runtime overrides for values loaded from .env.example.
    append_env_override "PUBLIC_NINETAILED_CLIENT_ID" "${PUBLIC_NINETAILED_CLIENT_ID:-}"
    append_env_override "PUBLIC_NINETAILED_ENVIRONMENT" "${PUBLIC_NINETAILED_ENVIRONMENT:-}"
    append_env_override "PUBLIC_CONTENTFUL_TOKEN" "${PUBLIC_CONTENTFUL_TOKEN:-}"
    append_env_override "PUBLIC_CONTENTFUL_PREVIEW_TOKEN" "${PUBLIC_CONTENTFUL_PREVIEW_TOKEN:-}"
    append_env_override "PUBLIC_CONTENTFUL_ENVIRONMENT" "${PUBLIC_CONTENTFUL_ENVIRONMENT:-}"
    append_env_override "PUBLIC_CONTENTFUL_SPACE_ID" "${PUBLIC_CONTENTFUL_SPACE_ID:-}"
    append_env_override "PUBLIC_CONTENTFUL_BASE_PATH" "${PUBLIC_CONTENTFUL_BASE_PATH:-}"

    log_info ".env file created at ${RN_DIR}/.env"
}

start_mock_server() {
    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."
    
    mkdir -p "$LOG_DIR"
    
    if lsof -ti:"${MOCK_SERVER_PORT}" > /dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} is already in use. Killing existing process..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    cd "$ROOT_DIR"
    if [[ "$STREAM_BACKGROUND_LOGS" == "true" ]]; then
        pnpm --dir "$ROOT_DIR/lib/mocks" serve 2>&1 | tee "$MOCK_SERVER_LOG" &
    else
        pnpm --dir "$ROOT_DIR/lib/mocks" serve > "$MOCK_SERVER_LOG" 2>&1 &
    fi
    MOCK_SERVER_PID=$!
    
    log_info "Mock server started with PID: $MOCK_SERVER_PID"
    
    if ! wait_for_port "${MOCK_SERVER_PORT}" "Mock server" 30; then
        log_error "Mock server failed to start. Check logs at: $MOCK_SERVER_LOG"
        cat "$MOCK_SERVER_LOG"
        exit 1
    fi
}

start_metro() {
    log_info "Starting Metro bundler on port ${METRO_PORT}..."
    
    mkdir -p "$LOG_DIR"
    
    cd "$RN_DIR"
    
    npx kill-port "$METRO_PORT" 2>/dev/null || true
    
    local metro_cmd=(npx react-native start --port "$METRO_PORT")
    if [[ "$METRO_VERBOSE" == "true" ]]; then
        metro_cmd+=(--verbose)
    fi

    if [[ "$STREAM_BACKGROUND_LOGS" == "true" ]]; then
        "${metro_cmd[@]}" 2>&1 | tee "$METRO_LOG" &
    else
        "${metro_cmd[@]}" > "$METRO_LOG" 2>&1 &
    fi
    METRO_PID=$!
    
    log_info "Metro bundler started with PID: $METRO_PID"
    
    if ! wait_for_port "${METRO_PORT}" "Metro bundler" 60; then
        if ! kill -0 "$METRO_PID" 2>/dev/null; then
            log_error "Metro bundler process exited unexpectedly. Check logs at: $METRO_LOG"
        else
            log_error "Metro bundler did not become ready on port ${METRO_PORT}. Check logs at: $METRO_LOG"
        fi
        cat "$METRO_LOG"
        exit 1
    fi

    if ! wait_for_metro_ready "${METRO_PORT}" 60; then
        cat "$METRO_LOG"
        exit 1
    fi
    
    log_info "Metro bundler is running"
}

setup_adb_reverse() {
    log_info "Setting up adb reverse port forwarding..."
    
    if ! command -v adb &> /dev/null; then
        log_warn "adb not found in PATH. Skipping reverse port setup."
        return 0
    fi
    
    if ! adb devices | grep -q "device$"; then
        log_warn "No Android device/emulator connected. Skipping reverse port setup."
        return 0
    fi
    
    adb reverse tcp:${MOCK_SERVER_PORT} tcp:${MOCK_SERVER_PORT}
    log_info "Port ${MOCK_SERVER_PORT} forwarded to emulator"
    
    adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT}
    log_info "Port ${METRO_PORT} forwarded to emulator"

    if [[ "$DISABLE_EMULATOR_ANIMATIONS" == "true" ]]; then
        log_info "Disabling emulator animations for faster UI transitions..."
        for animation_scale in window_animation_scale transition_animation_scale animator_duration_scale; do
            if adb shell settings put global "${animation_scale}" 0 > /dev/null 2>&1; then
                log_info "Set ${animation_scale}=0"
            else
                log_warn "Could not set ${animation_scale}=0; continuing"
            fi
        done
    else
        log_info "Skipping emulator animation changes (DISABLE_EMULATOR_ANIMATIONS=false)"
    fi
    
    if [[ "$ENABLE_DEVICE_LOGCAT" == "true" ]]; then
        log_info "Starting adb logcat (ENABLE_DEVICE_LOGCAT=true)..."
        adb logcat -c
        adb logcat ReactNative:V ReactNativeJS:V *:S 2>&1 | tee -a "$DEVICE_LOG" &
        LOGCAT_PID=$!
        log_info "Device logs will be displayed and saved to $DEVICE_LOG (PID: $LOGCAT_PID)"
    else
        log_info "Skipping adb logcat (set ENABLE_DEVICE_LOGCAT=true to enable)"
    fi
}

build_android() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi
    
    log_info "Building Android app..."
    
    cd "$RN_DIR"
    pnpm run test:e2e:android:build
    
    log_info "Android build complete"
}

run_tests() {
    log_info "Running E2E tests..."
    log_info "Test results will be saved to: $TEST_LOG"
    
    mkdir -p "$LOG_DIR"
    
    cd "$RN_DIR"
    
    local test_cmd="pnpm run test:e2e:android:run"
    
    if [[ -n "$TEST_FILE" ]]; then
        test_cmd="$test_cmd $TEST_FILE"
    fi
    
    if [[ -n "$TEST_NAME_PATTERN" ]]; then
        test_cmd="$test_cmd --testNamePattern \"$TEST_NAME_PATTERN\""
    fi
    
    set +e
    eval "$test_cmd" 2>&1 | tee "$TEST_LOG"
    local test_exit_code="${PIPESTATUS[0]}"
    set -e
    
    if [[ $test_exit_code -eq 0 ]]; then
        log_info "E2E tests completed successfully"
    else
        log_error "E2E tests failed with exit code $test_exit_code"
        log_error "Check test results in: $TEST_LOG"
        exit $test_exit_code
    fi
}

main() {
    parse_args "$@"
    
    log_info "=== React Native Android E2E Test Runner ==="
    log_info "Root directory: $ROOT_DIR"
    log_info "React Native directory: $RN_DIR"
    log_info "CI mode: $CI"
    [[ -n "$TEST_FILE" ]] && log_info "Test file: $TEST_FILE"
    [[ -n "$TEST_NAME_PATTERN" ]] && log_info "Test pattern: $TEST_NAME_PATTERN"
    
    create_env_file
    
    start_mock_server
    
    start_metro
    
    setup_adb_reverse
    
    build_android
    
    run_tests
    
    log_info "=== All tests completed successfully ==="
}

main "$@"
