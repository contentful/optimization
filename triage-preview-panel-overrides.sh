#!/usr/bin/env bash
#
# triage-preview-panel-overrides.sh
#
# One-off triage runner for PreviewPanelOverridesTests across all three mobile
# stacks (Android native, iOS native, RN-on-Android, RN-on-iOS). It delegates
# to each platform's existing run scripts, captures stdout+stderr and device
# logs per stack, and tears down emulator/simulator/mock-server/gradle daemon
# between stacks so we don't run out of RAM.
#
# Outputs:
#   triage-out/<timestamp>/<stack>.test.log   - test runner stdout+stderr
#   triage-out/<timestamp>/<stack>.device.log - logcat / simulator syslog dump
#   triage-out/<timestamp>/<stack>.exit-code  - integer exit code
#   triage-out/<timestamp>/summary.md         - per-stack PASS/FAIL summary
#
# Usage:
#   ./triage-preview-panel-overrides.sh                  # all four stacks
#   STACKS='android-native ios-native' ./triage-preview-panel-overrides.sh
#
# Stack names: android-native, ios-native, rn-on-android, rn-on-ios
#
# Env overrides:
#   STACKS              - space-separated subset of stacks (default: all four)
#   IOS_SIM_NAME        - iOS sim device name (default: iPhone 16e)
#   IOS_SIM_OS          - iOS sim runtime version (default: latest)
#   DETOX_AVD_NAME      - AVD that Detox should use on Android (default: pixel_7_api35_e2e)
#   ANDROID_EMU_AVD     - AVD that the Android native run script should use (default: pixel_7_api35_e2e)
#
# This script intentionally does NOT push fixes or modify the SDK. It just
# observes. After it finishes, read triage-out/<timestamp>/summary.md.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${REPO_ROOT}/triage-out/${TIMESTAMP}"
mkdir -p "$OUT_DIR"

ALL_STACKS=(android-native ios-native rn-on-android rn-on-ios)
STACKS="${STACKS:-${ALL_STACKS[*]}}"
IOS_SIM_NAME="${IOS_SIM_NAME:-iPhone 17}"
IOS_SIM_OS="${IOS_SIM_OS:-latest}"
DETOX_AVD_NAME="${DETOX_AVD_NAME:-pixel_7_api35_e2e}"
ANDROID_EMU_AVD="${ANDROID_EMU_AVD:-pixel_7_api35_e2e}"
# Detox's RN iOS device.type defaults to "iPad Pro 13-inch (M4)" in .detoxrc.js,
# which no longer exists on iOS 26.5 (replaced by M5). Pick a device that exists
# on every recent runtime so the rn-on-ios stage doesn't fail at device lookup.
DETOX_IOS_DEVICE="${DETOX_IOS_DEVICE:-iPhone 17}"
export DETOX_IOS_DEVICE

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { printf "${GREEN}[triage]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[triage]${NC} %s\n" "$1"; }
err() { printf "${RED}[triage]${NC} %s\n" "$1"; }

# ------------------------------------------------------------------ cleanup --

kill_android_emulator() {
    if pgrep -f 'qemu-system' >/dev/null; then
        log "Killing Android emulator(s)..."
        for serial in $(adb devices 2>/dev/null | awk '/^emulator-[0-9]+\tdevice$/ {print $1}'); do
            adb -s "$serial" emu kill 2>/dev/null || true
        done
        # Give qemu a chance to exit gracefully before SIGKILL
        for _ in 1 2 3 4 5 6 7 8; do
            if ! pgrep -f 'qemu-system' >/dev/null; then return 0; fi
            sleep 1
        done
        pkill -KILL -f 'qemu-system' 2>/dev/null || true
        sleep 2
    fi
}

shutdown_ios_simulators() {
    if xcrun simctl list devices 2>/dev/null | grep -qi booted; then
        log "Shutting down all booted iOS simulators..."
        xcrun simctl shutdown all 2>/dev/null || true
        sleep 3
    fi
}

stop_gradle_daemons() {
    log "Stopping Gradle daemons..."
    (cd "${REPO_ROOT}/implementations/android-sdk" && ./gradlew --stop >/dev/null 2>&1) || true
    (cd "${REPO_ROOT}/implementations/react-native-sdk/android" && ./gradlew --stop >/dev/null 2>&1) || true
}

kill_mock_server() {
    if lsof -ti:8000 >/dev/null 2>&1; then
        log "Killing any process on mock-server port 8000..."
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

cleanup_all_stacks() {
    kill_android_emulator
    shutdown_ios_simulators
    stop_gradle_daemons
    kill_mock_server
}

# ------------------------------------------------------------ device logs --

# Pull `adb logcat -d` after a test run (post-mortem capture; cheap and
# preserves what happened during the run since it's a ring buffer).
capture_logcat() {
    local out="$1"
    if adb devices 2>/dev/null | grep -q "device$"; then
        adb logcat -d -v threadtime > "$out" 2>&1 || true
    else
        : > "$out"
    fi
}

# iOS doesn't have a post-mortem ring buffer that survives sim shutdown, so
# we collect xcresult bundle output. Pass the xcresult path.
capture_xcresult() {
    local xcresult="$1"
    local out="$2"
    if [[ -d "$xcresult" ]]; then
        xcrun xcresulttool get --legacy --path "$xcresult" --format json > "$out" 2>&1 || \
            xcrun xcresulttool get --path "$xcresult" --format json > "$out" 2>&1 || \
            : > "$out"
    else
        : > "$out"
    fi
}

# -------------------------------------------------------------- per-stack --

run_android_native() {
    local stack="android-native"
    local test_log="${OUT_DIR}/${stack}.test.log"
    local device_log="${OUT_DIR}/${stack}.device.log"
    local exit_file="${OUT_DIR}/${stack}.exit-code"

    log "▶ Running stack: ${stack}"
    cleanup_all_stacks

    (
        cd "${REPO_ROOT}/implementations/android-sdk" || exit 1
        EMULATOR_AVD="$ANDROID_EMU_AVD" ./scripts/run-e2e.sh \
            --test-class PreviewPanelOverridesTests 2>&1
    ) > "$test_log" 2>&1
    local rc=$?
    echo "$rc" > "$exit_file"

    capture_logcat "$device_log"
    log "✓ Stack ${stack} complete (exit=$rc)"
}

run_ios_native() {
    local stack="ios-native"
    local test_log="${OUT_DIR}/${stack}.test.log"
    local device_log="${OUT_DIR}/${stack}.device.log"
    local exit_file="${OUT_DIR}/${stack}.exit-code"

    log "▶ Running stack: ${stack}"
    cleanup_all_stacks

    # Start mock server (the iOS test scripts assume it's running on 8000).
    pnpm --dir "${REPO_ROOT}/lib/mocks" serve > "${OUT_DIR}/${stack}.mock.log" 2>&1 &
    local mock_pid=$!
    # Wait for the mock server to be ready (up to 20s).
    for _ in $(seq 1 20); do nc -z localhost 8000 2>/dev/null && break; sleep 1; done

    # xcodebuild refuses to overwrite an existing -resultBundlePath, so clear
    # any leftover bundle from a prior run before invoking it.
    rm -rf /tmp/optimization-ios-derived-data/Test-SwiftUI.xcresult \
           /tmp/optimization-ios-derived-data/Test-UIKit.xcresult

    (
        cd "${REPO_ROOT}/implementations/ios-sdk" || exit 1
        # Build both schemes' test bundles.
        pnpm run test:e2e:ios:build:release 2>&1
        # Run only PreviewPanelOverridesTests on the SwiftUI scheme.
        IOS_SCHEME=SwiftUI \
        IOS_ONLY_TESTING=OptimizationAppUITestsSwiftUI/PreviewPanelOverridesTests \
        IOS_SIM_NAME="$IOS_SIM_NAME" \
        IOS_SIM_OS="$IOS_SIM_OS" \
            pnpm run test:e2e:ios:run:release 2>&1
    ) > "$test_log" 2>&1
    local rc=$?
    echo "$rc" > "$exit_file"

    # Capture the xcresult bundle (contains failures, attachments, sim logs).
    capture_xcresult /tmp/optimization-ios-derived-data/Test-SwiftUI.xcresult "$device_log"

    kill "$mock_pid" 2>/dev/null || true
    log "✓ Stack ${stack} complete (exit=$rc)"
}

run_rn_on_android() {
    local stack="rn-on-android"
    local test_log="${OUT_DIR}/${stack}.test.log"
    local device_log="${OUT_DIR}/${stack}.device.log"
    local exit_file="${OUT_DIR}/${stack}.exit-code"

    log "▶ Running stack: ${stack}"
    cleanup_all_stacks

    pnpm --dir "${REPO_ROOT}/lib/mocks" serve > "${OUT_DIR}/${stack}.mock.log" 2>&1 &
    local mock_pid=$!
    for _ in $(seq 1 20); do nc -z localhost 8000 2>/dev/null && break; sleep 1; done

    # Metro must be running on 8081 for the android.emu.debug build to load its
    # JS bundle. Detox's reversePorts: [8081] in .detoxrc.js sets up adb reverse
    # automatically, but it does not start Metro itself.
    pnpm --dir "${REPO_ROOT}/implementations/react-native-sdk" start \
        > "${OUT_DIR}/${stack}.metro.log" 2>&1 &
    local metro_pid=$!
    for _ in $(seq 1 30); do nc -z localhost 8081 2>/dev/null && break; sleep 1; done

    (
        cd "${REPO_ROOT}/implementations/react-native-sdk" || exit 1
        DETOX_AVD_NAME="$DETOX_AVD_NAME" pnpm run test:e2e:android:build 2>&1
        DETOX_AVD_NAME="$DETOX_AVD_NAME" pnpm exec detox test \
            --configuration android.emu.debug \
            --loglevel info \
            -- --runTestsByPath e2e/preview-panel-overrides.test.js 2>&1
    ) > "$test_log" 2>&1
    local rc=$?
    echo "$rc" > "$exit_file"

    capture_logcat "$device_log"
    kill "$metro_pid" 2>/dev/null || true
    kill "$mock_pid" 2>/dev/null || true
    log "✓ Stack ${stack} complete (exit=$rc)"
}

run_rn_on_ios() {
    local stack="rn-on-ios"
    local test_log="${OUT_DIR}/${stack}.test.log"
    local device_log="${OUT_DIR}/${stack}.device.log"
    local exit_file="${OUT_DIR}/${stack}.exit-code"

    log "▶ Running stack: ${stack}"
    cleanup_all_stacks

    pnpm --dir "${REPO_ROOT}/lib/mocks" serve > "${OUT_DIR}/${stack}.mock.log" 2>&1 &
    local mock_pid=$!
    for _ in $(seq 1 20); do nc -z localhost 8000 2>/dev/null && break; sleep 1; done

    # Metro must be running on 8081 for the ios.sim.debug build to load its JS
    # bundle. iOS simulator can reach host localhost directly, so no reverse
    # port setup is needed.
    pnpm --dir "${REPO_ROOT}/implementations/react-native-sdk" start \
        > "${OUT_DIR}/${stack}.metro.log" 2>&1 &
    local metro_pid=$!
    for _ in $(seq 1 30); do nc -z localhost 8081 2>/dev/null && break; sleep 1; done

    # Build the Detox iOS framework cache for the current Xcode version. This is
    # idempotent: Detox only rebuilds if the cache for the current Xcode + Detox
    # version is missing. Previous run failed with "Detox.framework could not be
    # found" after the Xcode upgrade invalidated the cached hash.
    (
        cd "${REPO_ROOT}/implementations/react-native-sdk" || exit 1
        pnpm exec detox build-framework-cache 2>&1
    ) > "${OUT_DIR}/${stack}.framework-cache.log" 2>&1 || true

    (
        cd "${REPO_ROOT}/implementations/react-native-sdk" || exit 1
        pnpm run test:e2e:ios:build 2>&1
        pnpm exec detox test \
            --configuration ios.sim.debug \
            --loglevel info \
            -- --runTestsByPath e2e/preview-panel-overrides.test.js 2>&1
    ) > "$test_log" 2>&1
    local rc=$?
    echo "$rc" > "$exit_file"

    # iOS sim ring-buffer dump (best effort; will be empty if sim already shut down).
    if xcrun simctl list devices 2>/dev/null | grep -qi booted; then
        xcrun simctl spawn booted log show --last 5m > "$device_log" 2>&1 || : > "$device_log"
    else
        : > "$device_log"
    fi
    kill "$metro_pid" 2>/dev/null || true
    kill "$mock_pid" 2>/dev/null || true
    log "✓ Stack ${stack} complete (exit=$rc)"
}

# ------------------------------------------------------------------ summary --

write_summary() {
    local summary="${OUT_DIR}/summary.md"
    {
        echo "# PreviewPanelOverridesTests triage — ${TIMESTAMP}"
        echo
        echo "| Stack | Exit code | Test log | Device log |"
        echo "|-------|-----------|----------|------------|"
        for stack in $STACKS; do
            local exit_file="${OUT_DIR}/${stack}.exit-code"
            local rc="(not run)"
            [[ -f "$exit_file" ]] && rc="$(cat "$exit_file")"
            echo "| ${stack} | ${rc} | [${stack}.test.log](./${stack}.test.log) | [${stack}.device.log](./${stack}.device.log) |"
        done
        echo
        echo "## Quick PASS/FAIL signals per stack"
        for stack in $STACKS; do
            local tl="${OUT_DIR}/${stack}.test.log"
            echo
            echo "### ${stack}"
            if [[ ! -f "$tl" ]]; then echo "(not run)"; continue; fi
            grep -E 'PASSED|FAILED|FAILURES|Tests run:|Test Suite|OK \(|Executed [0-9]+ tests' "$tl" | tail -10 || true
        done
    } > "$summary"
    log "Summary written to $summary"
    cat "$summary"
}

# ----------------------------------------------------------------- driver --

main() {
    log "Out dir: $OUT_DIR"
    log "Running stacks: $STACKS"

    for stack in $STACKS; do
        case "$stack" in
            android-native) run_android_native ;;
            ios-native)     run_ios_native ;;
            rn-on-android)  run_rn_on_android ;;
            rn-on-ios)      run_rn_on_ios ;;
            *) err "Unknown stack: $stack"; exit 1 ;;
        esac
    done

    log "Final cleanup..."
    cleanup_all_stacks
    write_summary
}

main "$@"
