#!/usr/bin/env bash
#
# run-e2e-android.sh - One-shot Android E2E Test Runner
#
# This script orchestrates the complete Android E2E testing workflow by:
#   1. Creating a .env file with mock server configuration
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
#   CI                - Set to "true" when running in CI environment (default: false)
#   VITE_NINETAILED_CLIENT_ID    - Ninetailed client ID (default: test-client-id)
#   VITE_NINETAILED_ENVIRONMENT  - Ninetailed environment (default: main)
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
#   All logs are written to implementations/react-native/logs/:
#     - mock-server.log  - Mock API server output
#     - metro.log        - Metro bundler output
#     - device.log       - Android device logcat output
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$RN_DIR/../.." && pwd)"

LOG_DIR="${RN_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
METRO_LOG="${LOG_DIR}/metro.log"
DEVICE_LOG="${LOG_DIR}/device.log"
MOCK_SERVER_PID=""
METRO_PID=""
LOGCAT_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
METRO_PORT="${METRO_PORT:-8081}"
SKIP_BUILD="${SKIP_BUILD:-false}"
CI="${CI:-false}"

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
  -t, --testNamePattern PATTERN   Run only tests matching the given pattern
  --skip-build                    Skip the Android build step
  -h, --help                      Show this help message

Environment Variables:
  MOCK_SERVER_PORT    Port for mock server (default: 8000)
  METRO_PORT          Port for Metro bundler (default: 8081)
  SKIP_BUILD          Set to 'true' to skip build (default: false)
  CI                  Set to 'true' for CI mode (default: false)

Examples:
  $(basename "$0")                                           # Run all tests
  $(basename "$0") e2e/my-test.test.js                       # Run specific test file
  $(basename "$0") -t "should display variant"               # Run tests matching pattern
  $(basename "$0") e2e/my-test.test.js -t "should display"   # Combine file and pattern
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
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

cleanup() {
    log_info "Cleaning up background processes..."
    
    if [[ -n "$LOGCAT_PID" ]] && kill -0 "$LOGCAT_PID" 2>/dev/null; then
        log_info "Stopping adb logcat (PID: $LOGCAT_PID)..."
        kill "$LOGCAT_PID" 2>/dev/null || true
        wait "$LOGCAT_PID" 2>/dev/null || true
    fi
    
    if [[ -n "$METRO_PID" ]]; then
        log_info "Stopping Metro bundler (PID: $METRO_PID) and its process group..."
        pkill -P "$METRO_PID" 2>/dev/null || true
        kill "$METRO_PID" 2>/dev/null || true
        wait "$METRO_PID" 2>/dev/null || true
    fi
    
    if lsof -ti:"${METRO_PORT}" > /dev/null 2>&1; then
        log_info "Killing any remaining processes on Metro port ${METRO_PORT}..."
        lsof -ti:"${METRO_PORT}" | xargs kill -9 2>/dev/null || true
    fi
    
    if [[ -n "$MOCK_SERVER_PID" ]]; then
        log_info "Stopping mock server (PID: $MOCK_SERVER_PID) and its process group..."
        pkill -P "$MOCK_SERVER_PID" 2>/dev/null || true
        kill "$MOCK_SERVER_PID" 2>/dev/null || true
        wait "$MOCK_SERVER_PID" 2>/dev/null || true
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

create_env_file() {
    log_info "Creating .env file..."
    
    cat > "${RN_DIR}/.env" << EOF
VITE_NINETAILED_CLIENT_ID=${VITE_NINETAILED_CLIENT_ID:-test-client-id}
VITE_NINETAILED_ENVIRONMENT=${VITE_NINETAILED_ENVIRONMENT:-main}
VITE_EXPERIENCE_API_BASE_URL=http://localhost:${MOCK_SERVER_PORT}/experience/
VITE_INSIGHTS_API_BASE_URL=http://localhost:${MOCK_SERVER_PORT}/insights/
VITE_CONTENTFUL_TOKEN=${VITE_CONTENTFUL_TOKEN:-test-token}
VITE_CONTENTFUL_ENVIRONMENT=${VITE_CONTENTFUL_ENVIRONMENT:-master}
VITE_CONTENTFUL_SPACE_ID=${VITE_CONTENTFUL_SPACE_ID:-test-space}
VITE_CONTENTFUL_CDA_HOST=localhost:${MOCK_SERVER_PORT}
VITE_CONTENTFUL_BASE_PATH=/contentful/
EOF
    
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
    pnpm --filter mocks serve 2>&1 | tee "$MOCK_SERVER_LOG" &
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
    
    npx react-native start --port "$METRO_PORT" --verbose 2>&1 | tee "$METRO_LOG" &
    METRO_PID=$!
    
    log_info "Metro bundler started with PID: $METRO_PID"
    
    log_info "Waiting for Metro bundler to initialize..."
    sleep 10
    
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
        log_error "Metro bundler failed to start. Check logs at: $METRO_LOG"
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
    
    log_info "Setting up adb logcat to display device logs..."
    adb logcat -c
    adb logcat ReactNative:V ReactNativeJS:V *:S 2>&1 | tee -a "$DEVICE_LOG" &
    LOGCAT_PID=$!
    
    log_info "Device logs will be displayed and saved to $DEVICE_LOG (PID: $LOGCAT_PID)"
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
    
    cd "$RN_DIR"
    
    local detox_args=("test" "--configuration" "android.emu.debug")
    
    if [[ -n "$TEST_NAME_PATTERN" ]]; then
        detox_args+=("--testNamePattern" "$TEST_NAME_PATTERN")
        log_info "Filtering tests by pattern: $TEST_NAME_PATTERN"
    fi
    
    if [[ -n "$TEST_FILE" ]]; then
        detox_args+=("$TEST_FILE")
        log_info "Running test file: $TEST_FILE"
    fi
    
    log_info "Executing: detox ${detox_args[*]}"
    npx detox "${detox_args[@]}"
    
    log_info "E2E tests complete"
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

