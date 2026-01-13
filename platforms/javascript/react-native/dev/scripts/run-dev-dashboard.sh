#!/usr/bin/env bash
#
# run-dev-dashboard.sh - React Native Dev Dashboard Setup & Runner
#
# This script orchestrates the complete development environment by:
#   1. Installing workspace dependencies
#   2. Starting the mock API server (from lib/mocks)
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
#   - Node.js >= 18
#   - pnpm
#   - Watchman (recommended)
#   - For iOS: Xcode with iOS simulator, CocoaPods
#   - For Android: Android SDK with emulator, adb in PATH
#
# Logs:
#   All logs are written to platforms/javascript/react-native/dev/logs/:
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
ROOT_DIR="$(cd "$RN_PACKAGE_DIR/../../.." && pwd)"

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
  - Node.js >= 18
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

cleanup() {
    log_info "Cleaning up background processes..."
    
    # Stop Metro bundler and its children
    if [[ -n "$METRO_PID" ]]; then
        log_info "Stopping Metro bundler (PID: $METRO_PID) and its process group..."
        pkill -P "$METRO_PID" 2>/dev/null || true
        kill "$METRO_PID" 2>/dev/null || true
        wait "$METRO_PID" 2>/dev/null || true
    fi
    
    # Kill any remaining processes on Metro port
    if lsof -ti:"${METRO_PORT}" > /dev/null 2>&1; then
        log_info "Killing any remaining processes on Metro port ${METRO_PORT}..."
        lsof -ti:"${METRO_PORT}" | xargs kill -9 2>/dev/null || true
    fi
    
    # Stop mock server and its children
    if [[ -n "$MOCK_SERVER_PID" ]]; then
        log_info "Stopping mock server (PID: $MOCK_SERVER_PID) and its process group..."
        pkill -P "$MOCK_SERVER_PID" 2>/dev/null || true
        kill "$MOCK_SERVER_PID" 2>/dev/null || true
        wait "$MOCK_SERVER_PID" 2>/dev/null || true
    fi
    
    # Kill any remaining processes on mock server port
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
    log_step "Creating .env File"
    
    cat > "${DEV_DIR}/.env" << EOF
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
    
    log_info ".env file created at ${DEV_DIR}/.env"
}

install_dependencies() {
    log_step "Installing Dependencies"
    
    cd "$ROOT_DIR"
    log_info "Running pnpm install..."
    pnpm install
    log_info "Dependencies installed"
}

start_mock_server() {
    log_step "Starting Mock Server"
    
    mkdir -p "$LOG_DIR"
    
    # Kill existing process on port
    if lsof -ti:"${MOCK_SERVER_PORT}" > /dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} is already in use. Killing existing process..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    cd "$ROOT_DIR"
    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."
    
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
    log_step "Starting Metro Bundler"
    
    mkdir -p "$LOG_DIR"
    
    # Kill existing process on port
    if lsof -ti:"${METRO_PORT}" > /dev/null 2>&1; then
        log_warn "Port ${METRO_PORT} is already in use. Killing existing process..."
        lsof -ti:"${METRO_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    cd "$DEV_DIR"
    log_info "Starting Metro bundler on port ${METRO_PORT}..."
    
    npx react-native start --port "$METRO_PORT" --config "$DEV_DIR/metro.config.js" 2>&1 | tee "$METRO_LOG" &
    METRO_PID=$!
    
    log_info "Metro bundler started with PID: $METRO_PID"
    
    # Wait for Metro to initialize
    log_info "Waiting for Metro bundler to initialize..."
    sleep 10
    
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
        log_error "Metro bundler failed to start. Check logs at: $METRO_LOG"
        cat "$METRO_LOG"
        exit 1
    fi
    
    log_info "Metro bundler is running"
}

setup_ios() {
    log_step "Setting Up iOS"
    
    cd "$DEV_DIR/ios"
    
    if [[ "$CLEAN_BUILD" == true ]]; then
        log_info "Cleaning iOS build..."
        rm -rf ~/Library/Developer/Xcode/DerivedData 2>/dev/null || true
        rm -rf Pods Podfile.lock build 2>/dev/null || true
        # Clean CocoaPods cache to fix "null byte" errors
        pod cache clean --all 2>/dev/null || true
    fi
    
    # Check if pods need to be installed
    if [[ ! -d "Pods" ]] || [[ "$CLEAN_BUILD" == true ]]; then
        log_info "Installing CocoaPods..."
        # Clean existing pods to avoid null byte issues in monorepos
        rm -rf Pods Podfile.lock 2>/dev/null || true
        pod install --repo-update
    else
        log_info "Pods already installed, skipping..."
    fi
    
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
        npx react-native run-ios --no-packager --port "$METRO_PORT"
    else
        log_info "Building and launching Android app..."
        npx react-native run-android --no-packager --port "$METRO_PORT"
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
    wait "$METRO_PID" 2>/dev/null || true
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
    
    start_mock_server
    
    start_metro
    
    if [[ "$PLATFORM" == "ios" ]]; then
        setup_ios
    else
        setup_android
    fi
    
    show_server_info
    
    if [[ "$START_APP" == true ]]; then
        run_app
    fi
    
    # Keep servers running until Ctrl+C
    wait_forever
}

main "$@"
