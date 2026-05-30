#!/usr/bin/env bash
#
# run-e2e.sh - Run the XCUITest E2E suite against the iOS reference app
#
# This script:
#   1. Runs preflight checks (same as bootstrap.sh) and stops with remediation
#      steps if any fail
#   2. Builds the JS bridge bundle and installs pnpm dependencies if needed
#   3. Generates the Xcode project from project.yml (XcodeGen)
#   4. Starts the mock API server (lib/mocks) on http://localhost:8000
#   5. Resolves an iOS Simulator and runs the XCUITest suite via xcodebuild
#   6. Cleans up the mock server on exit
#
# Unlike the Android runner, no port forwarding is required: the iOS Simulator
# shares the host network, so tests reach the mock server at localhost:8000
# directly.
#
# Environment Variables:
#   APP_SHELL         - Which shell to test: "swiftui", "uikit", or "both"
#                       (default: swiftui)
#   IOS_SIM_NAME      - Simulator device name (default: "iPhone 16"); falls back
#                       to the first available iPhone if the named device is absent
#   MOCK_SERVER_PORT  - Port for the mock API server (default: 8000). The app is
#                       hardcoded to localhost:8000, so override this only if you
#                       also change shared/Config.swift.
#   ONLY_TESTING      - Restrict the run to a test target/class/method, e.g.
#                       "OptimizationAppUITestsSwiftUI/PreviewPanelOverridesTests"
#                       (default: run the whole suite)
#   SKIP_BUILD        - Set to "true" to run test-without-building and reuse the
#                       last build products (default: false)
#
# Prerequisites (verified by the preflight checks below):
#   - macOS
#   - Xcode (full IDE, not just the Command Line Tools) with its license accepted
#   - Xcode Command Line Tools
#   - XcodeGen (auto-installed via Homebrew if missing and brew is available)
#   - Node.js and pnpm

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

APP_SHELL="${APP_SHELL:-swiftui}"
IOS_SIM_NAME="${IOS_SIM_NAME:-iPhone 16}"
MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
ONLY_TESTING="${ONLY_TESTING:-}"
SKIP_BUILD="${SKIP_BUILD:-false}"

LOG_DIR="${APP_DIR}/logs"
DERIVED_DATA="/tmp/optimization-ios-e2e-derived-data"

MOCK_SERVER_PID=""
SIM_UDID=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}==>${NC} $1"; }

# Print a multi-line remediation block, then exit non-zero. Used by preflight so
# a failing check tells the user exactly how to fix it before anything runs.
fail_preflight() {
    echo ""
    log_error "Preflight check failed."
    echo -e "$1"
    echo ""
    exit 1
}

cleanup() {
    log_info "Cleaning up..."
    if [[ -n "$MOCK_SERVER_PID" ]] && kill -0 "$MOCK_SERVER_PID" 2>/dev/null; then
        log_info "Stopping mock server (PID: $MOCK_SERVER_PID)..."
        kill "$MOCK_SERVER_PID" 2>/dev/null || true
        wait "$MOCK_SERVER_PID" 2>/dev/null || true
    fi
    log_info "Cleanup complete"
}

trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Preflight checks (mirrors bootstrap.sh)
# ---------------------------------------------------------------------------

preflight_macos() {
    log_step "Checking operating system..."
    if [[ "$(uname -s)" != "Darwin" ]]; then
        fail_preflight "iOS development requires macOS. This script is running on '$(uname -s)'.

  Building and running an iOS Simulator is only possible on a Mac with Xcode.
  If you need to validate bridge behavior on another OS, use the Android
  reference app (implementations/android-sdk) instead."
    fi
    log_info "macOS detected ($(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null))"
}

preflight_command_line_tools() {
    log_step "Checking Xcode Command Line Tools..."
    if ! xcode-select -p >/dev/null 2>&1; then
        fail_preflight "The Xcode Command Line Tools are not installed.

  Install them with:

      xcode-select --install

  A system dialog will appear — click \"Install\" and wait for it to finish,
  then re-run this script."
    fi
    log_info "Command Line Tools active at: $(xcode-select -p)"
}

preflight_xcode() {
    log_step "Checking Xcode..."

    local version_output
    if ! version_output="$(xcodebuild -version 2>&1)"; then
        if echo "$version_output" | grep -qi "requires Xcode"; then
            fail_preflight "Xcode is not installed, or the active developer directory points at the
  Command Line Tools instead of the full Xcode app.

  1. Install Xcode from the Mac App Store:
         https://apps.apple.com/app/xcode/id497799835

  2. Launch Xcode once so it can finish installing its components.

  3. Point the command-line tools at Xcode and accept the license:
         sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
         sudo xcodebuild -license accept

  Then re-run this script."
        fi
        if echo "$version_output" | grep -qi "license"; then
            fail_preflight "You have not accepted the Xcode license agreement.

  Accept it with:

      sudo xcodebuild -license accept

  Then re-run this script."
        fi
        fail_preflight "Unable to run 'xcodebuild -version'. Output was:

$version_output

  Make sure Xcode is installed and selected:
      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
      sudo xcodebuild -license accept"
    fi

    local dev_dir
    dev_dir="$(xcode-select -p 2>/dev/null)"
    if [[ "$dev_dir" != *"/Xcode"*"/Contents/Developer"* && "$dev_dir" != *".app/Contents/Developer" ]]; then
        fail_preflight "The active developer directory ('$dev_dir') does not look like a full
  Xcode install. Point it at Xcode and re-run:

      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
      sudo xcodebuild -license accept"
    fi

    log_info "$(echo "$version_output" | head -n1) ($dev_dir)"
}

preflight_simulator() {
    log_step "Checking iOS Simulator runtimes..."
    if ! xcrun simctl list devices >/dev/null 2>&1; then
        fail_preflight "Unable to query iOS simulators with 'xcrun simctl'.

  Open Xcode, then go to Settings -> Components (or Platforms) and download an
  iOS Simulator runtime. Then re-run this script."
    fi

    if ! xcrun simctl list devices available | grep -qE "^[[:space:]]*iPhone .*\([0-9A-Fa-f-]{36}\)"; then
        fail_preflight "No available iPhone simulators were found.

  Open Xcode -> Settings -> Components (or Platforms) and download an iOS
  Simulator runtime, or create a simulator in Xcode -> Window -> Devices and
  Simulators. Then re-run this script."
    fi
    log_info "iOS simulators available"
}

preflight_node_pnpm() {
    log_step "Checking Node.js and pnpm..."
    if ! command -v node >/dev/null 2>&1; then
        fail_preflight "Node.js is not installed or not on PATH.

  Install the version pinned in .nvmrc. With a version manager such as nvm:

      nvm install
      nvm use

  Then re-run this script."
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
        fail_preflight "pnpm is not installed or not on PATH.

  The repository uses pnpm. Enable it via Corepack (bundled with Node.js):

      corepack enable
      corepack prepare pnpm@latest --activate

  Then re-run this script."
    fi
    log_info "node $(node --version), pnpm $(pnpm --version)"
}

preflight_xcodegen() {
    log_step "Checking XcodeGen..."
    if command -v xcodegen >/dev/null 2>&1; then
        log_info "xcodegen $(xcodegen --version 2>/dev/null | head -n1)"
        return 0
    fi

    log_warn "xcodegen not found."
    if command -v brew >/dev/null 2>&1; then
        log_info "Installing xcodegen via Homebrew..."
        if brew install xcodegen; then
            log_info "xcodegen installed"
            return 0
        fi
        fail_preflight "Homebrew failed to install xcodegen. Install it manually with:

      brew install xcodegen

  Then re-run this script."
    fi

    fail_preflight "XcodeGen is required to generate the Xcode project, and Homebrew was not
  found to install it automatically.

  Install Homebrew (https://brew.sh) and then XcodeGen:

      brew install xcodegen

  Then re-run this script."
}

run_preflight() {
    log_info "=== Running preflight checks ==="
    preflight_macos
    preflight_command_line_tools
    preflight_xcode
    preflight_simulator
    preflight_node_pnpm
    preflight_xcodegen
    log_info "=== All preflight checks passed ==="
    echo ""
}

# ---------------------------------------------------------------------------
# Resolve the chosen app shell(s) into schemes
# ---------------------------------------------------------------------------

resolve_schemes() {
    case "$APP_SHELL" in
        swiftui) SCHEMES=("OptimizationAppSwiftUI") ;;
        uikit) SCHEMES=("OptimizationAppUIKit") ;;
        both) SCHEMES=("OptimizationAppSwiftUI" "OptimizationAppUIKit") ;;
        *)
            log_error "Unknown APP_SHELL='$APP_SHELL'. Use 'swiftui', 'uikit', or 'both'."
            exit 1
            ;;
    esac
    log_info "App shell: $APP_SHELL (schemes: ${SCHEMES[*]})"
}

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install_dependencies() {
    if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
        log_step "Installing pnpm dependencies (first run)..."
        pnpm --dir "$ROOT_DIR" install
    else
        log_info "pnpm dependencies already installed"
    fi
}

build_js_bridge() {
    log_step "Building the JS bridge bundle..."
    pnpm --dir "$ROOT_DIR" --filter @contentful/optimization-js-bridge build
    log_info "JS bridge built"
}

generate_project() {
    log_step "Generating the Xcode project (xcodegen)..."
    (cd "$APP_DIR" && xcodegen generate)
    log_info "Xcode project generated"
}

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

start_mock_server() {
    log_step "Starting mock server on port ${MOCK_SERVER_PORT}..."
    mkdir -p "$LOG_DIR"

    if lsof -ti:"${MOCK_SERVER_PORT}" >/dev/null 2>&1; then
        log_warn "Port ${MOCK_SERVER_PORT} already in use. Killing existing process..."
        lsof -ti:"${MOCK_SERVER_PORT}" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    PORT="${MOCK_SERVER_PORT}" pnpm --dir "$ROOT_DIR/lib/mocks" serve \
        >"$LOG_DIR/mock-server.log" 2>&1 &
    MOCK_SERVER_PID=$!

    if ! wait_for_port "${MOCK_SERVER_PORT}" "Mock server" 30; then
        log_error "Mock server failed to start. Logs:"
        cat "$LOG_DIR/mock-server.log"
        exit 1
    fi
}

resolve_simulator() {
    log_step "Resolving iOS Simulator..."

    local line
    line="$(xcrun simctl list devices available \
        | grep -E "^[[:space:]]*${IOS_SIM_NAME} \(" | head -n1 || true)"

    if [[ -z "$line" ]]; then
        log_warn "Simulator '${IOS_SIM_NAME}' not found. Falling back to the first available iPhone."
        line="$(xcrun simctl list devices available \
            | grep -E "^[[:space:]]*iPhone .*\([0-9A-Fa-f-]{36}\)" | head -n1 || true)"
    fi

    SIM_UDID="$(echo "$line" \
        | grep -oE "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}" \
        | head -n1)"

    if [[ -z "$SIM_UDID" ]]; then
        log_error "Could not resolve a simulator UDID. Available devices:"
        xcrun simctl list devices available
        exit 1
    fi

    local sim_label
    sim_label="$(echo "$line" | sed -E 's/ \([0-9A-Fa-f-]{36}\).*//' | xargs)"
    log_info "Using simulator: ${sim_label} ($SIM_UDID)"
}

# ---------------------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------------------

run_scheme() {
    local scheme="$1"
    local action="test"
    if [[ "$SKIP_BUILD" == "true" ]]; then
        action="test-without-building"
        log_step "Testing $scheme (reusing last build)..."
    else
        log_step "Building and testing $scheme..."
    fi

    local -a cmd=(
        xcodebuild "$action"
        -project "$APP_DIR/OptimizationApp.xcodeproj"
        -scheme "$scheme"
        -destination "platform=iOS Simulator,id=$SIM_UDID"
        -derivedDataPath "$DERIVED_DATA"
        -resultBundlePath "$LOG_DIR/${scheme}.xcresult"
    )
    if [[ -n "$ONLY_TESTING" ]]; then
        cmd+=(-only-testing:"$ONLY_TESTING")
    fi

    # A previous run leaves a result bundle behind; xcodebuild refuses to
    # overwrite it, so clear it first.
    rm -rf "$LOG_DIR/${scheme}.xcresult"

    if command -v xcbeautify >/dev/null 2>&1; then
        set -o pipefail
        "${cmd[@]}" | xcbeautify
    else
        "${cmd[@]}"
    fi
    log_info "$scheme tests passed (result bundle: $LOG_DIR/${scheme}.xcresult)"
}

run_tests() {
    mkdir -p "$LOG_DIR"
    for scheme in "${SCHEMES[@]}"; do
        run_scheme "$scheme"
    done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
    log_info "=== iOS E2E Test Runner ==="
    log_info "Root: $ROOT_DIR"
    log_info "App:  $APP_DIR"
    echo ""

    run_preflight

    resolve_schemes
    install_dependencies
    build_js_bridge
    generate_project
    start_mock_server
    resolve_simulator
    run_tests

    echo ""
    log_info "=== E2E tests complete ==="
}

main "$@"
