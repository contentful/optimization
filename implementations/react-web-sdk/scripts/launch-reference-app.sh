#!/usr/bin/env bash
#
# launch-reference-app.sh - One-shot React Web SDK Reference Implementation Launcher
#
# This script configures and launches the React Web SDK reference implementation
# from scratch, including:
#   1. Verifying prerequisites (Node.js, pnpm)
#   2. Installing monorepo dependencies (if needed)
#   3. Building SDK packages and packing tarballs
#   4. Installing implementation dependencies
#   5. Creating a .env file from .env.example (if needed)
#   6. Starting the mock API server
#   7. Starting the Rsbuild dev server
#   8. Cleaning up all background processes on exit
#
# Unlike the SDK dev harness (packages/web/frameworks/react-web-sdk/scripts/
# launch-dev-harness.sh), this script launches the reference implementation which
# consumes the SDK as a published package — the same way a real customer would.
# This requires building and packing SDK tarballs first.
#
# Environment Variables:
#   MOCK_SERVER_PORT          - Port for mock API server (default: 8000)
#   DEV_SERVER_PORT           - Port for Rsbuild dev server (default: 3000)
#   SKIP_BUILD                - Set to "true" to skip package build step (default: false)
#   SKIP_INSTALL              - Set to "true" to skip dependency installation (default: false)
#   STREAM_BACKGROUND_LOGS    - Set to "true" to stream mock server logs to stdout (default: false)
#
# Usage:
#   ./scripts/launch-reference-app.sh                          # Full setup + launch
#   SKIP_BUILD=true ./scripts/launch-reference-app.sh          # Skip package build
#   SKIP_INSTALL=true ./scripts/launch-reference-app.sh        # Skip all install steps
#
# Prerequisites:
#   - Node.js >= 20.19.0 (see .nvmrc for recommended version)
#   - pnpm 10.x
#
# Logs:
#   All background logs are written to implementations/react-web-sdk/logs/:
#     - mock-server.log  - Mock API server output
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMPL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$IMPL_DIR/../.." && pwd)"

LOG_DIR="${IMPL_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
MOCK_SERVER_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
DEV_SERVER_PORT="${DEV_SERVER_PORT:-3000}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"
STREAM_BACKGROUND_LOGS="${STREAM_BACKGROUND_LOGS:-false}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

One-shot setup and launch for the React Web SDK reference implementation.

This consumes the SDK as a published package (via local tarballs), the same
way a real customer would integrate it.

Options:
  --skip-build      Skip SDK package build step (use when packages are already built)
  --skip-install    Skip all dependency installation steps
  -h, --help        Show this help message

Environment Variables:
  MOCK_SERVER_PORT          Port for mock server (default: 8000)
  DEV_SERVER_PORT           Port for dev server (default: 3000)
  SKIP_BUILD                Set to 'true' to skip build (default: false)
  SKIP_INSTALL              Set to 'true' to skip install (default: false)
  STREAM_BACKGROUND_LOGS    Set to 'true' to stream mock logs to stdout (default: false)

Examples:
  $(basename "$0")                     # Full setup + launch
  $(basename "$0") --skip-build        # Skip package build
  $(basename "$0") --skip-install      # Skip all install steps
  SKIP_BUILD=true $(basename "$0")     # Same as --skip-build
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            --skip-install)
                SKIP_INSTALL="true"
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
    echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"
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
        if lsof -ti:"$port" > /dev/null 2>&1; then
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

check_prerequisites() {
    log_step "Checking prerequisites"

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js >= 20.19.0"
        exit 1
    fi
    log_info "Node.js $(node --version) found"

    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm 10.x"
        exit 1
    fi
    log_info "pnpm $(pnpm --version) found"
}

setup_env() {
    log_step "Setting up environment"

    if [[ -f "${IMPL_DIR}/.env" ]]; then
        log_info ".env file already exists, keeping existing configuration"
    else
        log_info "Creating .env from .env.example..."
        cp "${IMPL_DIR}/.env.example" "${IMPL_DIR}/.env"
        log_info ".env created with mock-safe defaults"
    fi
}

install_dependencies() {
    if [[ "$SKIP_INSTALL" == "true" ]]; then
        log_step "Skipping dependency installation (SKIP_INSTALL=true)"
        return 0
    fi

    log_step "Installing monorepo dependencies"

    if [[ -d "${ROOT_DIR}/node_modules" ]]; then
        log_info "Monorepo node_modules exists, skipping root install"
    else
        log_info "Running pnpm install..."
        (cd "$ROOT_DIR" && pnpm install)
    fi
}

build_packages() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_step "Skipping package build (SKIP_BUILD=true)"
        return 0
    fi

    log_step "Building SDK packages"

    log_info "Running pnpm build:pkgs (this may take a moment)..."
    (cd "$ROOT_DIR" && pnpm build:pkgs)
    log_info "SDK packages built and packed successfully"
}

install_implementation() {
    if [[ "$SKIP_INSTALL" == "true" ]]; then
        log_step "Skipping implementation install (SKIP_INSTALL=true)"
        return 0
    fi

    log_step "Installing implementation dependencies"

    log_info "Running implementation:install for react-web-sdk..."
    (cd "$ROOT_DIR" && pnpm run implementation:run -- react-web-sdk implementation:install)
    log_info "Implementation dependencies installed"
}

start_mock_server() {
    log_step "Starting mock API server"

    mkdir -p "$LOG_DIR"

    if lsof -ti:"${MOCK_SERVER_PORT}" > /dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} is already in use"
        log_info "Assuming mock server is already running"
        return 0
    fi

    log_info "Starting mock server on port ${MOCK_SERVER_PORT}..."

    if [[ "$STREAM_BACKGROUND_LOGS" == "true" ]]; then
        PORT="${MOCK_SERVER_PORT}" pnpm --dir "${ROOT_DIR}/lib/mocks" serve 2>&1 | tee "$MOCK_SERVER_LOG" &
    else
        PORT="${MOCK_SERVER_PORT}" pnpm --dir "${ROOT_DIR}/lib/mocks" serve > "$MOCK_SERVER_LOG" 2>&1 &
    fi
    MOCK_SERVER_PID=$!

    wait_for_port "${MOCK_SERVER_PORT}" "Mock API server" 30
}

start_dev_server() {
    log_step "Starting React dev server"

    log_info "Launching Rsbuild dev server on port ${DEV_SERVER_PORT}..."
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  React Web SDK Reference App is starting!${NC}"
    echo -e "${GREEN}  App:   http://localhost:${DEV_SERVER_PORT}${NC}"
    echo -e "${GREEN}  Mocks: http://localhost:${MOCK_SERVER_PORT}${NC}"
    echo -e "${GREEN}  Press Ctrl+C to stop all services${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    (cd "$IMPL_DIR" && PORT="${DEV_SERVER_PORT}" pnpm dev)
}

main() {
    parse_args "$@"

    echo -e "${BLUE}"
    echo "┌──────────────────────────────────────────────────────────┐"
    echo "│   React Web SDK Reference App - One-Shot Launcher        │"
    echo "│                                                          │"
    echo "│   Consumes SDK as a published package (like a customer)  │"
    echo "└──────────────────────────────────────────────────────────┘"
    echo -e "${NC}"

    check_prerequisites
    setup_env
    install_dependencies
    build_packages
    install_implementation
    start_mock_server
    start_dev_server
}

main "$@"
