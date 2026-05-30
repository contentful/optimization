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
# Assumes the emulator is booted, both APKs are installed, the mock server is reachable
# (via 10.0.2.2), and Maestro is installed. It does NOT manage those — the CI job and the
# emulator-runner action own them (see .github/workflows/main-pipeline.yaml). For the
# local equivalent that manages everything, use run-e2e.sh.
#
# Usage: ci-maestro-run.sh <appId> [<appId> ...]
# Env:
#   MAESTRO_BIN        Path to the maestro binary (default: $HOME/.maestro/bin/maestro)
#   MAESTRO_FLOWS_DIR  Flows directory (default: implementations/android-sdk/maestro)
#   MAESTRO_ATTEMPTS   Total attempts per app, full + surgical retries (default: 2)
#   MAESTRO_ITERATIONS Repeat the whole per-app loop N times for flake sweeps (default: 1)

set -uo pipefail

MAESTRO="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"
FLOWS_DIR="${MAESTRO_FLOWS_DIR:-implementations/android-sdk/maestro}"
# Total attempts per app: 1 full run + (ATTEMPTS-1) surgical retries of only the failed
# flows. Surgical retries are cheap (a flow or two), so default to a couple of them to
# absorb the genuinely flaky network-recovery flows.
ATTEMPTS="${MAESTRO_ATTEMPTS:-3}"
ITERATIONS="${MAESTRO_ITERATIONS:-1}"
# If more than this many flows fail at once, treat it as systemic (not a flake) and do
# not retry — re-running a large set only deepens an emulator wedge.
MAX_RETRY_FLOWS="${MAX_RETRY_FLOWS:-8}"
# Most recent Maestro run's combined output, parsed to recover the failed-flow set.
LAST_OUT="${TMPDIR:-/tmp}/ci-maestro-out.txt"

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

run_app() {
    local app="$1" attempt=1 names files count
    echo "--- Maestro: ${app} (attempt 1, full suite) ---"
    if run_maestro "${app}"; then
        return 0
    fi

    while [ "${attempt}" -lt "${ATTEMPTS}" ]; do
        attempt=$((attempt + 1))
        names="$(failed_flows)"
        files="$(resolve_files "${names}")"
        count="$(printf '%s\n' ${names} | grep -c . || true)"

        # A large failed set is a systemic problem (e.g. a wedged emulator), not a flake.
        # Re-running dozens of flows only deepens the wedge, so fail fast instead.
        if [ "${count}" -gt "${MAX_RETRY_FLOWS}" ]; then
            echo "::error::${app}: ${count} flows failed — systemic failure, not retrying (see logcat artifact)"
            return 1
        fi

        cooldown

        if [ -z "${files}" ]; then
            echo "::warning::${app} attempt ${attempt}: could not identify failed flow files; retrying whole suite once"
            run_maestro "${app}" && return 0
            continue
        fi
        echo "::warning::${app} attempt ${attempt}: re-running only failed flow(s):${files}"
        # shellcheck disable=SC2086 -- intentional word-splitting of the flow file list
        run_maestro "${app}" ${files} && return 0
    done

    echo "::error::${app} failed after ${ATTEMPTS} attempt(s)"
    return 1
}

main() {
    if [ "$#" -eq 0 ]; then
        echo "usage: $(basename "$0") <appId> [<appId> ...]" >&2
        exit 2
    fi

    local rc=0 iter=0
    while [ "${iter}" -lt "${ITERATIONS}" ]; do
        iter=$((iter + 1))
        [ "${ITERATIONS}" -gt 1 ] && echo "=== iteration ${iter}/${ITERATIONS} ==="
        for app in "$@"; do
            run_app "${app}" || rc=1
        done
    done
    exit "${rc}"
}

main "$@"
