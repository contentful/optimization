#!/usr/bin/env bash
#
# launch-dev-harness.sh - One-shot React Web SDK Dev Harness Launcher
#
# This script configures and launches the React Web SDK dev harness from scratch:
#   1. Verifying prerequisites (Node.js, pnpm)
#   2. Installing monorepo dependencies (if needed)
#   3. Creating a .env file from dev/.env.example (if needed)
#   4. Starting the mock API server
#   5. Starting the Rsbuild dev server with hot reload across the full SDK stack
#   6. Cleaning up all background processes on exit
#
# The dev harness resolves all SDK packages from source via Rsbuild aliases,
# so no build step is needed. Changes to the React SDK, Web SDK, Core SDK,
# API client, or API schemas are hot-reloaded instantly.
#
# Environment Variables:
#   MOCK_SERVER_PORT          - Port for mock API server (default: 8000)
#   SKIP_INSTALL              - Set to "true" to skip dependency installation (default: false)
#   STREAM_BACKGROUND_LOGS    - Set to "true" to stream mock server logs to stdout (default: false)
#
# Usage:
#   ./scripts/launch-dev-harness.sh                          # Full setup + launch
#   SKIP_INSTALL=true ./scripts/launch-dev-harness.sh        # Skip install step
#
# Prerequisites:
#   - Node.js >= 20.19.0 (see .nvmrc for recommended version)
#   - pnpm 10.x
#
# Logs:
#   Background logs are written to packages/web/frameworks/react-web-sdk/logs/:
#     - mock-server.log  - Mock API server output
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PKG_DIR/../../../.." && pwd)"

LOG_DIR="${PKG_DIR}/logs"
MOCK_SERVER_LOG="${LOG_DIR}/mock-server.log"
MOCK_SERVER_PID=""

MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
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

One-shot setup and launch for the React Web SDK dev harness.

The dev harness compiles all SDK packages from source (no build step needed),
enabling hot reload across the entire SDK stack.

Options:
  --skip-install    Skip dependency installation
  -h, --help        Show this help message

Environment Variables:
  MOCK_SERVER_PORT          Port for mock server (default: 8000)
  SKIP_INSTALL              Set to 'true' to skip install (default: false)
  STREAM_BACKGROUND_LOGS    Set to 'true' to stream mock logs to stdout (default: false)

Examples:
  $(basename "$0")                        # Full setup + launch
  $(basename "$0") --skip-install         # Skip install step
  SKIP_INSTALL=true $(basename "$0")      # Same as --skip-install
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
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

    if [[ -f "${PKG_DIR}/.env" ]]; then
        log_info ".env file already exists, keeping existing configuration"
    else
        log_info "Creating .env from dev/.env.example..."
        cp "${PKG_DIR}/dev/.env.example" "${PKG_DIR}/.env"
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

start_dev_harness() {
    log_step "Starting React Web SDK dev harness"

    log_info "Launching Rsbuild dev server with full SDK source hot reload..."
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  React Web SDK Dev Harness is starting!${NC}"
    echo -e "${GREEN}  Mocks: http://localhost:${MOCK_SERVER_PORT}${NC}"
    echo -e "${GREEN}  Press Ctrl+C to stop all services${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    (cd "$PKG_DIR" && pnpm dev)
}

main() {
    parse_args "$@"

    echo -e "${BLUE}"
    echo "┌────────────────────────────────────────────────────────┐"
    echo "│   React Web SDK Dev Harness - One-Shot Launcher        │"
    echo "│                                                        │"
    echo "│   Hot reloads: React SDK, Web SDK, Core SDK,           │"
    echo "│                API Client, API Schemas                 │"
    echo "└────────────────────────────────────────────────────────┘"
    echo -e "${NC}"

    check_prerequisites
    setup_env
    install_dependencies
    start_mock_server
    start_dev_harness
}

main "$@"
