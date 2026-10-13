#!/usr/bin/env bash
#
# run-dev-dashboard.sh - React Native Dev Dashboard Setup & Runner
#
# This script orchestrates the complete development environment by:
#   1. Installing workspace dependencies
#   2. Starting the mock API server
#   3. Starting the Metro bundler for React Native
#   4. Installing CocoaPods (iOS) or setting up adb reverse (Android)
#   5. Building and launching the app on simulator/emulator
#   6. Cleaning up all background processes on exit
#
# Environment Variables:
#   MOCK_SERVER_PORT  - Port for mock API server (default: 8000)
#   METRO_PORT        - Port for Metro bundler (default: 8081)
#
# Usage:
#   ./scripts/run-dev-dashboard.sh              # Run on iOS (default)
#   ./scripts/run-dev-dashboard.sh --android    # Run on Android
#   ./scripts/run-dev-dashboard.sh --no-app     # Start servers only
#   ./scripts/run-dev-dashboard.sh --clean      # Clean build first
#
# Prerequisites:
#   - Node.js version from .nvmrc
#   - pnpm
#   - Watchman (recommended)
#   - For iOS: Xcode with iOS simulator, CocoaPods
#   - For Android: Android SDK with emulator, adb in PATH
#
# Logs:
#   All logs are written to packages/react-native-sdk/dev/logs/:
#     - mock-server.log  - Mock API server output
#     - metro.log        - Metro bundler output
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RN_PACKAGE_DIR="$(cd "$DEV_DIR/.." && pwd)"
ROOT_DIR="$(cd "$RN_PACKAGE_DIR/../.." && pwd)"

LOG_DIR="${DEV_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
METRO_LOG="${LOG_DIR}/metro.log"

MOCK_SERVER_PID=""
METRO_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
METRO_PORT="${METRO_PORT:-8081}"

# Default options
PLATFORM="ios"
START_APP=true
CLEAN_BUILD=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Run the React Native Dev Dashboard for testing the Contentful Optimization SDK.

Options:
  --ios             Run on iOS simulator (default)
  --android         Run on Android emulator
  --no-app          Only start mock server and Metro bundler (don't launch app)
  --clean           Clean build before starting
  -h, --help        Show this help message

Environment Variables:
  MOCK_SERVER_PORT  Port for mock server (default: 8000)
  METRO_PORT        Port for Metro bundler (default: 8081)

Examples:
  $(basename "$0")                  # Run on iOS
  $(basename "$0") --android        # Run on Android
  $(basename "$0") --no-app         # Start servers only, launch app manually
  $(basename "$0") --clean --ios    # Clean iOS build and run

Prerequisites:
  - Node.js version from .nvmrc
  - pnpm
  - Watchman (brew install watchman)
  - For iOS: Xcode with iOS simulator, CocoaPods
  - For Android: Android Studio with emulator configured
EOF
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

log_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

stop_process_tree() {
    local pid="$1"
    local child
    for child in $(pgrep -P "$pid" || true); do
        stop_process_tree "$child"
    done
    kill "$pid" 2>/dev/null || true
}

cleanup() {
    log_info "Stopping only the processes started by this launcher..."
    if [[ -n "$METRO_PID" ]]; then
        stop_process_tree "$METRO_PID"
        wait "$METRO_PID" 2>/dev/null || true
    fi
    if [[ -n "$MOCK_SERVER_PID" ]]; then
        stop_process_tree "$MOCK_SERVER_PID"
        wait "$MOCK_SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

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
        attempt=$((attempt + 1))
    done
    
    echo ""
    log_error "$name did not become ready on port $port after $max_attempts seconds"
    return 1
}

create_env_file() {
    log_step "Creating .env File"
    
    if [[ -f "${DEV_DIR}/.env" ]]; then
        log_info "Keeping the existing .env"
        return 0
    fi
    cp "${DEV_DIR}/.env.example" "${DEV_DIR}/.env"

    log_info ".env file created at ${DEV_DIR}/.env"
}

install_dependencies() {
    log_step "Installing Dependencies"
    
    cd "$ROOT_DIR"
    if [[ -d "${ROOT_DIR}/node_modules" ]]; then
        log_info "Workspace dependencies already exist"
        return 0
    fi
    log_info "Running pnpm install..."
    pnpm install
    log_info "Dependencies installed"
}

start_mock_server() {
    log_step "Starting Mock Server"
    
    mkdir -p "$LOG_DIR"
    
    if lsof -ti:"${MOCK_SERVER_PORT}" > /dev/null 2>&1; then
        if curl --fail --silent "http://localhost:${MOCK_SERVER_PORT}/health" > /dev/null; then
            log_info "Reusing the existing mock server"
            return 0
        fi
        log_error "Mock server port ${MOCK_SERVER_PORT} is occupied by another service"
        exit 1
    fi

    cd "$ROOT_DIR"
    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."
    
    PORT="${MOCK_SERVER_PORT}" pnpm --dir "$ROOT_DIR" serve:mocks > "$MOCK_SERVER_LOG" 2>&1 &
    MOCK_SERVER_PID=$!
    
    log_info "Mock server started with PID: $MOCK_SERVER_PID"
    
    if ! wait_for_port "${MOCK_SERVER_PORT}" "Mock server" 30; then
        log_error "Mock server failed to start. Check logs at: $MOCK_SERVER_LOG"
        cat "$MOCK_SERVER_LOG"
        exit 1
    fi
}

run_native_cli() {
    MOCK_SERVER_PORT="$MOCK_SERVER_PORT" \
    pnpm --dir "$RN_PACKAGE_DIR" exec bash -c 'cd "$1"; shift; exec react-native "$@"' -- "$DEV_DIR" "$@"
}

start_metro() {
    log_step "Starting Metro Bundler"
    
    mkdir -p "$LOG_DIR"
    
    if lsof -ti:"${METRO_PORT}" > /dev/null 2>&1; then
        if [[ "$(curl --fail --silent "http://localhost:${METRO_PORT}/status")" == "packager-status:running" ]]; then
            log_info "Reusing the existing Metro bundler"
            return 0
        fi
        log_error "Metro port ${METRO_PORT} is occupied by another service"
        exit 1
    fi

    cd "$DEV_DIR"
    log_info "Starting Metro bundler on port ${METRO_PORT}..."
    
    run_native_cli start --port "$METRO_PORT" --config "$DEV_DIR/metro.config.cjs" > "$METRO_LOG" 2>&1 &
    METRO_PID=$!
    
    log_info "Metro bundler started with PID: $METRO_PID"
    
    if ! wait_for_port "${METRO_PORT}" "Metro" 30; then
        cat "$METRO_LOG"
        exit 1
    fi

    log_info "Metro bundler is running"
}

setup_ios() {
    log_step "Setting Up iOS"
    
    cd "$DEV_DIR/ios"
    
    if [[ "$CLEAN_BUILD" == true ]]; then
        log_info "Cleaning this harness's iOS build..."
        xcodebuild -workspace ReactNativeApp.xcworkspace -scheme ReactNativeApp clean
    fi

    log_info "Installing CocoaPods..."
    pod install --repo-update
    
    log_info "iOS setup complete"
}

setup_android() {
    log_step "Setting Up Android"
    
    if [[ "$CLEAN_BUILD" == true ]]; then
        log_info "Cleaning Android build..."
        cd "$DEV_DIR/android"
        ./gradlew clean 2>/dev/null || true
    fi
    
    # Setup adb reverse port forwarding
    if command -v adb &> /dev/null; then
        if adb devices | grep -q "device$"; then
            log_info "Setting up adb reverse port forwarding..."
            adb reverse tcp:${MOCK_SERVER_PORT} tcp:${MOCK_SERVER_PORT}
            log_info "Port ${MOCK_SERVER_PORT} forwarded to emulator"
            adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT}
            log_info "Port ${METRO_PORT} forwarded to emulator"
        else
            log_warn "No Android device/emulator connected. Skipping reverse port setup."
        fi
    fi
    
    log_info "Android setup complete"
}

run_app() {
    log_step "Launching App"
    
    cd "$DEV_DIR"
    
    if [[ "$PLATFORM" == "ios" ]]; then
        log_info "Building and launching iOS app..."
        run_native_cli run-ios --no-packager --port "$METRO_PORT"
    else
        log_info "Building and launching Android app..."
        run_native_cli run-android --no-packager --port "$METRO_PORT"
    fi
}

show_server_info() {
    log_step "Development Servers Running"
    
    echo ""
    echo -e "  ${GREEN}Mock Server${NC}:  http://localhost:${MOCK_SERVER_PORT}"
    echo -e "    - Experience API: http://localhost:${MOCK_SERVER_PORT}/experience/"
    echo -e "    - Insights API:   http://localhost:${MOCK_SERVER_PORT}/insights/"
    echo -e "    - Contentful CDA: http://localhost:${MOCK_SERVER_PORT}/contentful/"
    echo ""
    echo -e "  ${GREEN}Metro Bundler${NC}: http://localhost:${METRO_PORT}"
    echo ""
    echo -e "  ${GREEN}Logs${NC}:"
    echo -e "    - Mock Server: $MOCK_SERVER_LOG"
    echo -e "    - Metro:       $METRO_LOG"
    echo ""
    
    if [[ "$START_APP" == false ]]; then
        echo -e "  ${YELLOW}To launch the app manually:${NC}"
        echo -e "    iOS:     cd $RN_PACKAGE_DIR && pnpm dev:ios"
        echo -e "    Android: cd $RN_PACKAGE_DIR && pnpm dev:android"
        echo ""
    fi
}

wait_forever() {
    log_info "Press Ctrl+C to stop all servers and exit"
    
    # Wait for Metro process (it will run until killed)
    if [[ -n "$METRO_PID" ]]; then
        wait "$METRO_PID" 2>/dev/null || true
    else
        while true; do sleep 1; done
    fi
}

# =============================================================================
# Argument Parsing
# =============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --ios)
                PLATFORM="ios"
                shift
                ;;
            --android)
                PLATFORM="android"
                shift
                ;;
            --no-app)
                START_APP=false
                shift
                ;;
            --clean)
                CLEAN_BUILD=true
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
                log_error "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# =============================================================================
# Main
# =============================================================================

main() {
    parse_args "$@"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Contentful Optimization - React Native Dev Dashboard                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Platform: $PLATFORM"
    log_info "Root directory: $ROOT_DIR"
    log_info "Dev directory: $DEV_DIR"
    log_info "Clean build: $CLEAN_BUILD"
    log_info "Launch app: $START_APP"
    
    create_env_file
    
    install_dependencies

    if [[ "$START_APP" == true ]]; then
        if [[ "$PLATFORM" == "ios" ]]; then
            setup_ios
        else
            setup_android
        fi
    fi
    
    start_mock_server
    
    start_metro
    
    show_server_info
    
    if [[ "$START_APP" == true ]]; then
        run_app
    fi
    
    # Keep servers running until Ctrl+C
    wait_forever
}

main "$@"
