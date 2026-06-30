#!/usr/bin/env bash
#
# ci-maestro-run.sh - Run the Android Maestro suite for one or more apps in CI with
# SURGICAL retry.
#
# Why this exists: re-running the entire 36-flow suite on a failure (the old inline
# retry) put a second full pass of force-stops/launches on a single long-lived emulator
# session. The package manager became unresponsive on that second pass
# ("Unable to clear state: pm list packages --user 0 ..."), turning a single flaky flow
# into a total wipeout. Instead, on failure we re-run ONLY the flows that actually
# failed — Maestro writes exactly one `screenshot-<x>-(flow-name).png` per failed flow,
# so the failure set is recoverable from the latest test-output directory. This keeps the
# emulator healthy and still absorbs the occasional genuinely-flaky flow (e.g. the
# airplane-mode network-recovery flows, whose timing is nondeterministic on the CI
# netsim WiFi stack).
#
# Assumes the emulator has been started, the target APK is installed, the mock server is
# running on the host, and Maestro is installed. This script owns the final device
# preparation and health checks before the flows begin. For the local equivalent that
# manages everything, use run-e2e.sh.
#
# Usage: ci-maestro-run.sh <appId> [<appId> ...]
# Env:
#   MAESTRO_BIN        Path to the maestro binary (default: $HOME/.maestro/bin/maestro)
#   MAESTRO_FLOWS_DIR  Flows directory (default: implementations/android-sdk/maestro)
#   MAESTRO_ATTEMPTS   Total attempts per app, full + surgical retries (default: 3)
#   MAESTRO_HEALTHCHECK_ATTEMPTS
#                    Total pre-suite Maestro/ADB bootstrap attempts (default: 3)
#   MAESTRO_HEALTHCHECK_FLOW
#                    CI-only warm-up flow (default: $MAESTRO_FLOWS_DIR/ci-healthcheck.yaml)
#   MAESTRO_ITERATIONS Repeat the whole per-app loop N times for flake sweeps (default: 1)
#   MOCK_SERVER_PORT   Host mock server port (default: 8000)

set -uo pipefail

MAESTRO="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"
FLOWS_DIR="${MAESTRO_FLOWS_DIR:-implementations/android-sdk/maestro}"
HEALTHCHECK_FLOW="${MAESTRO_HEALTHCHECK_FLOW:-${FLOWS_DIR}/ci-healthcheck.yaml}"
MOCK_SERVER_PORT="${MOCK_SERVER_PORT:-8000}"
# Total attempts per app: 1 full run + (ATTEMPTS-1) surgical retries of only the failed
# flows. Surgical retries are cheap (a flow or two), so default to a couple of them to
# absorb the genuinely flaky network-recovery flows.
ATTEMPTS="${MAESTRO_ATTEMPTS:-3}"
HEALTHCHECK_ATTEMPTS="${MAESTRO_HEALTHCHECK_ATTEMPTS:-3}"
ITERATIONS="${MAESTRO_ITERATIONS:-1}"
# If more than this many flows fail at once, treat it as systemic (not a flake) and do
# not retry — re-running a large set only deepens an emulator wedge.
MAX_RETRY_FLOWS="${MAX_RETRY_FLOWS:-8}"
# Most recent Maestro run's combined output, parsed to recover the failed-flow set.
LAST_OUT="${TMPDIR:-/tmp}/ci-maestro-out.txt"
HEALTHCHECK_OUT="${TMPDIR:-/tmp}/ci-maestro-healthcheck-out.txt"
MAESTRO_TESTS_DIR="${MAESTRO_TESTS_DIR:-$HOME/.maestro/tests}"
LOGCAT_FILE="${ANDROID_LOGCAT_FILE:-/tmp/android-logcat.txt}"

SYSTEM_DIALOG_RE="Process system isn.t responding|Application isn.t responding|android:id/aerr_(close|wait)"
DEVICE_HEALTH_RE="Unable to clear state|Unable to launch app|pm list packages|PackageManager|device offline|adb: device offline|device unauthorized|No connected devices"
BOOTSTRAP_HEALTH_RE="${DEVICE_HEALTH_RE}|UNAVAILABLE|host:transport|Not able to reach the gRPC server"

wait_for_device_boot() {
    echo "[ci-maestro] waiting for adb device and Android boot completion..."
    if ! adb wait-for-device >/dev/null 2>&1; then
        echo "::error::adb wait-for-device failed"
        return 1
    fi

    local i boot_completed
    for i in $(seq 1 90); do
        boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
        if [ "${boot_completed}" = "1" ]; then
            echo "[ci-maestro] Android boot completed"
            return 0
        fi
        sleep 2
    done

    echo "::error::Android did not report sys.boot_completed=1 before Maestro setup"
    return 1
}

wait_for_package_manager() {
    echo "[ci-maestro] waiting for PackageManager to respond..."
    local i
    for i in $(seq 1 60); do
        if adb shell cmd package list packages >/dev/null 2>&1; then
            echo "[ci-maestro] PackageManager is responsive"
            return 0
        fi
        sleep 2
    done

    echo "::error::PackageManager did not respond before Maestro setup"
    return 1
}

restore_network_state() {
    echo "[ci-maestro] restoring emulator network state..."
    adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
    adb shell svc wifi enable >/dev/null 2>&1 || true
    adb shell svc data enable >/dev/null 2>&1 || true
}

configure_device_settings() {
    echo "[ci-maestro] configuring stable device settings..."
    adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
    adb shell input keyevent 82 >/dev/null 2>&1 || true

    for animation_scale in window_animation_scale transition_animation_scale animator_duration_scale; do
        if ! adb shell settings put global "${animation_scale}" 0 >/dev/null 2>&1; then
            echo "::error::Failed to set ${animation_scale}=0"
            return 1
        fi
    done

    if ! adb shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1; then
        echo "::error::Failed to set screen_off_timeout"
        return 1
    fi

    if ! adb shell settings put global hide_error_dialogs 1 >/dev/null 2>&1; then
        echo "::error::Failed to set hide_error_dialogs=1"
        return 1
    fi

    local hide_error_dialogs
    hide_error_dialogs="$(adb shell settings get global hide_error_dialogs 2>/dev/null | tr -d '\r' || true)"
    if [ "${hide_error_dialogs}" != "1" ]; then
        echo "::error::hide_error_dialogs verification failed (value: ${hide_error_dialogs:-unset})"
        return 1
    fi
}

configure_adb_reverse() {
    echo "[ci-maestro] setting adb reverse localhost fallback..."
    adb reverse "tcp:${MOCK_SERVER_PORT}" "tcp:${MOCK_SERVER_PORT}" || \
        echo "::warning::adb reverse failed; apps use 10.0.2.2 so continuing"
}

verify_mock_reachable() {
    echo "[ci-maestro] verifying host mock reachability from emulator via 10.0.2.2:${MOCK_SERVER_PORT}..."
    local i
    for i in $(seq 1 30); do
        if adb shell "toybox nc -z 10.0.2.2 ${MOCK_SERVER_PORT} 2>/dev/null || nc -z 10.0.2.2 ${MOCK_SERVER_PORT} 2>/dev/null" >/dev/null 2>&1; then
            echo "[ci-maestro] Host mock reachable at 10.0.2.2:${MOCK_SERVER_PORT}"
            return 0
        fi
        sleep 1
    done

    echo "::error::Host mock was not reachable from the emulator at 10.0.2.2:${MOCK_SERVER_PORT}"
    return 1
}

start_logcat_capture() {
    local mode="${1:-append}"
    if [ -z "${LOGCAT_FILE}" ]; then
        return 0
    fi

    if pgrep -f "adb logcat -v threadtime" >/dev/null 2>&1; then
        return 0
    fi

    echo "[ci-maestro] starting background logcat capture..."
    if [ "${mode}" = "reset" ]; then
        adb logcat -c || true
        nohup adb logcat -v threadtime > "${LOGCAT_FILE}" 2>&1 &
    else
        nohup adb logcat -v threadtime >> "${LOGCAT_FILE}" 2>&1 &
    fi
}

ensure_logcat_capture() {
    start_logcat_capture "append"
}

prepare_device() {
    wait_for_device_boot || return 1
    wait_for_package_manager || return 1
    restore_network_state
    configure_device_settings || return 1
    configure_adb_reverse
    verify_mock_reachable || return 1
    start_logcat_capture "reset"
}

latest_maestro_output_dir() {
    find "${MAESTRO_TESTS_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -1
}

has_infrastructure_failure() {
    if [ -f "${LAST_OUT}" ] && grep -qiE "${DEVICE_HEALTH_RE}|${SYSTEM_DIALOG_RE}" "${LAST_OUT}" 2>/dev/null; then
        return 0
    fi

    local latest_dir
    latest_dir="$(latest_maestro_output_dir || true)"
    if [ -n "${latest_dir}" ] && grep -R -qiE "${SYSTEM_DIALOG_RE}" "${latest_dir}" 2>/dev/null; then
        return 0
    fi

    return 1
}

healthcheck_has_bootstrap_failure() {
    if [ -f "${HEALTHCHECK_OUT}" ] && grep -qiE "${BOOTSTRAP_HEALTH_RE}|${SYSTEM_DIALOG_RE}" "${HEALTHCHECK_OUT}" 2>/dev/null; then
        return 0
    fi

    return 1
}

print_healthcheck_diagnostics() {
    echo "::group::Android Maestro healthcheck diagnostics"
    if [ -f "${HEALTHCHECK_OUT}" ]; then
        echo "[ci-maestro] Healthcheck output signals:"
        grep -niE "${BOOTSTRAP_HEALTH_RE}|${SYSTEM_DIALOG_RE}" "${HEALTHCHECK_OUT}" 2>/dev/null | head -80 || true
    fi

    local latest_dir
    latest_dir="$(latest_maestro_output_dir || true)"
    if [ -n "${latest_dir}" ]; then
        echo "[ci-maestro] Latest Maestro output directory: ${latest_dir}"
        grep -R -niE "${BOOTSTRAP_HEALTH_RE}|${SYSTEM_DIALOG_RE}" "${latest_dir}" 2>/dev/null | head -80 || true
    fi

    if [ -f "${LOGCAT_FILE}" ]; then
        echo "[ci-maestro] logcat signals:"
        grep -niE "ANR in|FATAL EXCEPTION|not responding|Unable to clear state|pm list packages|PackageManager|device offline|lowmemorykiller|Process .* died|Low on memory" "${LOGCAT_FILE}" 2>/dev/null | head -80 || true
    fi
    echo "::endgroup::"
}

print_failure_diagnostics() {
    echo "::group::Android Maestro infrastructure diagnostics"
    if [ -f "${LAST_OUT}" ]; then
        echo "[ci-maestro] Maestro output signals:"
        grep -niE "${DEVICE_HEALTH_RE}|${SYSTEM_DIALOG_RE}" "${LAST_OUT}" 2>/dev/null | head -80 || true
    fi

    local latest_dir
    latest_dir="$(latest_maestro_output_dir || true)"
    if [ -n "${latest_dir}" ]; then
        echo "[ci-maestro] Latest Maestro output directory: ${latest_dir}"
        grep -R -niE "${SYSTEM_DIALOG_RE}" "${latest_dir}" 2>/dev/null | head -80 || true
    fi

    if [ -f "${LOGCAT_FILE}" ]; then
        echo "[ci-maestro] logcat signals:"
        grep -niE "ANR in|FATAL EXCEPTION|not responding|Unable to clear state|pm list packages|PackageManager|device offline|lowmemorykiller|Process .* died|Low on memory" "${LOGCAT_FILE}" 2>/dev/null | head -80 || true
    fi
    echo "::endgroup::"
}

report_infrastructure_failure() {
    local app="$1"
    echo "::error::${app}: Android emulator/system failure detected; not retrying app flows"
    print_failure_diagnostics
}

# Names of the flows that failed in the most recent `maestro test` run. Maestro writes
# one screenshot per failed flow into a fresh timestamped directory; the flow name is the
# parenthesized suffix of the screenshot filename.
# Run Maestro for an app against the given flow paths (default: the whole suite),
# echoing output to the console while capturing it for failure analysis. Returns
# Maestro's exit code: pipefail makes the pipeline fail when Maestro fails even though
# `tee` exits 0.
run_maestro() {
    local app="$1"
    shift
    if [ "$#" -eq 0 ]; then set -- "${FLOWS_DIR}"; fi
    "${MAESTRO}" test -e APP_ID="${app}" "$@" 2>&1 | tee "${LAST_OUT}"
}

run_maestro_healthcheck() {
    local app="$1"
    if [ ! -f "${HEALTHCHECK_FLOW}" ]; then
        echo "::error::Maestro healthcheck flow not found: ${HEALTHCHECK_FLOW}"
        return 1
    fi

    "${MAESTRO}" test -e APP_ID="${app}" "${HEALTHCHECK_FLOW}" 2>&1 | tee "${HEALTHCHECK_OUT}"
}

# Names of the flows that failed in the most recent run, parsed from Maestro's
# "[Failed] <flow-name> (..)" lines. Parsing the output (rather than the per-failure
# screenshots) also catches "Unable to launch app" / "Unable to clear state" failures,
# which produce no screenshot.
failed_flows() {
    grep -oE '\[Failed\] [A-Za-z0-9._-]+' "${LAST_OUT}" 2>/dev/null |
        awk '{print $2}' | sort -u
}

# Map flow names to their .yaml paths under the flows directory.
resolve_files() {
    local names="$1" files="" name f
    for name in ${names}; do
        f="$(find "${FLOWS_DIR}" -name "${name}.yaml" | head -1)"
        [ -n "${f}" ] && files="${files} ${f}"
    done
    echo "${files}"
}

# Between attempts: ensure radio/WiFi are back on (a flow that died mid airplane-mode
# toggle can leave the device offline, which would fail every later flow and the mock at
# 10.0.2.2), free memory, and let the system settle so the retry runs on a healthy
# system.
cooldown() {
    adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
    adb shell svc wifi enable >/dev/null 2>&1 || true
    adb shell svc data enable >/dev/null 2>&1 || true
    adb shell am kill-all >/dev/null 2>&1 || true
    sleep 8
}

recover_after_healthcheck_failure() {
    echo "[ci-maestro] recovering from Maestro/ADB healthcheck failure..."
    adb reconnect offline >/dev/null 2>&1 || true
    wait_for_device_boot || return 1
    wait_for_package_manager || return 1
    restore_network_state
    configure_device_settings || return 1
    configure_adb_reverse
    verify_mock_reachable || return 1
    ensure_logcat_capture
    sleep 3
}

warm_up_maestro() {
    local app="$1" attempt=1

    while [ "${attempt}" -le "${HEALTHCHECK_ATTEMPTS}" ]; do
        echo "--- Maestro healthcheck: ${app} (attempt ${attempt}/${HEALTHCHECK_ATTEMPTS}) ---"
        if run_maestro_healthcheck "${app}"; then
            echo "[ci-maestro] Maestro healthcheck passed"
            ensure_logcat_capture
            return 0
        fi

        if ! healthcheck_has_bootstrap_failure; then
            echo "::error::${app}: Maestro healthcheck failed without Android bootstrap failure signals"
            print_healthcheck_diagnostics
            return 1
        fi

        print_healthcheck_diagnostics

        if [ "${attempt}" -ge "${HEALTHCHECK_ATTEMPTS}" ]; then
            echo "::error::${app}: Maestro/ADB bootstrap did not stabilize after ${HEALTHCHECK_ATTEMPTS} healthcheck attempt(s)"
            return 1
        fi

        echo "::warning::${app}: Maestro/ADB bootstrap not ready; retrying healthcheck"
        recover_after_healthcheck_failure || return 1
        attempt=$((attempt + 1))
    done
}

# Restart the Android framework between apps. A full session's worth of clearState
# (pm clear) operations wedges the PackageManager — Maestro's pre-clear "pm list packages"
# starts timing out and every subsequent flow fails with "Unable to clear state". Bouncing
# system_server gives the next app a fresh PackageManager (each app then does ~36 clears,
# well under the wedge threshold). Device settings (hide_error_dialogs, the disabled Google
# feed) live in the settings provider and persist across the restart.
reset_framework() {
    echo "[ci-maestro] restarting Android framework so the next app gets a fresh PackageManager..."
    adb shell stop >/dev/null 2>&1 || true
    adb shell start >/dev/null 2>&1 || true
    wait_for_device_boot || return 1
    wait_for_package_manager || return 1
    sleep 3
}

run_app() {
    local app="$1" attempt=1 names files count
    echo "--- Maestro: ${app} (attempt 1, full suite) ---"
    if run_maestro "${app}"; then
        return 0
    fi
    if has_infrastructure_failure; then
        report_infrastructure_failure "${app}"
        return 1
    fi

    while [ "${attempt}" -lt "${ATTEMPTS}" ]; do
        attempt=$((attempt + 1))
        names="$(failed_flows)"
        files="$(resolve_files "${names}")"
        count="$(printf '%s\n' ${names} | grep -c . || true)"

        # A large failed set is a systemic problem (e.g. a wedged emulator), not a flake.
        # Re-running dozens of flows only deepens the wedge, so fail fast instead.
        if [ "${count}" -gt "${MAX_RETRY_FLOWS}" ]; then
            echo "::error::${app}: ${count} flows failed together; treating as systemic failure, not retrying"
            print_failure_diagnostics
            return 1
        fi

        cooldown

        if [ -z "${files}" ]; then
            echo "::warning::${app} attempt ${attempt}: could not identify failed flow files; retrying whole suite once"
            if run_maestro "${app}"; then
                return 0
            fi
            if has_infrastructure_failure; then
                report_infrastructure_failure "${app}"
                return 1
            fi
            continue
        fi
        echo "::warning::${app} attempt ${attempt}: re-running only failed flow(s):${files}"
        # shellcheck disable=SC2086 -- intentional word-splitting of the flow file list
        if run_maestro "${app}" ${files}; then
            return 0
        fi
        if has_infrastructure_failure; then
            report_infrastructure_failure "${app}"
            return 1
        fi
    done

    echo "::error::${app} failed after ${ATTEMPTS} attempt(s)"
    return 1
}

main() {
    if [ "$#" -eq 0 ]; then
        echo "usage: $(basename "$0") <appId> [<appId> ...]" >&2
        exit 2
    fi

    local rc=0 iter=0 first
    while [ "${iter}" -lt "${ITERATIONS}" ]; do
        iter=$((iter + 1))
        [ "${ITERATIONS}" -gt 1 ] && echo "=== iteration ${iter}/${ITERATIONS} ==="
        first=1
        for app in "$@"; do
            if [ "${first}" -eq 0 ]; then
                reset_framework || {
                    rc=1
                    continue
                }
            fi
            first=0
            prepare_device || {
                rc=1
                continue
            }
            warm_up_maestro "${app}" || {
                rc=1
                continue
            }
            run_app "${app}" || rc=1
        done
    done
    exit "${rc}"
}

main "$@"
