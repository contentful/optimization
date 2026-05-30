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
ATTEMPTS="${MAESTRO_ATTEMPTS:-2}"
ITERATIONS="${MAESTRO_ITERATIONS:-1}"
TESTS_DIR="${HOME}/.maestro/tests"

# Names of the flows that failed in the most recent `maestro test` run. Maestro writes
# one screenshot per failed flow into a fresh timestamped directory; the flow name is the
# parenthesized suffix of the screenshot filename.
failed_flows() {
    local latest
    latest="$(ls -dt "${TESTS_DIR}"/*/ 2>/dev/null | head -1)"
    [ -z "${latest}" ] && return 0
    find "${latest}" -maxdepth 1 -name 'screenshot-*.png' 2>/dev/null |
        sed -E 's/.*\(([^)]+)\)\.png$/\1/' | sort -u
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

# Let the emulator reclaim memory between attempts so a retry runs on a healthy system.
cooldown() {
    adb shell am kill-all >/dev/null 2>&1 || true
    sleep 5
}

run_app() {
    local app="$1" attempt=1 names files
    echo "--- Maestro: ${app} (attempt 1, full suite) ---"
    if "${MAESTRO}" test -e APP_ID="${app}" "${FLOWS_DIR}"; then
        return 0
    fi

    while [ "${attempt}" -lt "${ATTEMPTS}" ]; do
        attempt=$((attempt + 1))
        names="$(failed_flows)"
        cooldown
        if [ -z "${names}" ]; then
            echo "::warning::${app} attempt ${attempt}: could not identify failed flows; re-running full suite"
            "${MAESTRO}" test -e APP_ID="${app}" "${FLOWS_DIR}" && return 0
            continue
        fi
        files="$(resolve_files "${names}")"
        echo "::warning::${app} attempt ${attempt}: re-running only failed flow(s):${files}"
        # shellcheck disable=SC2086 -- intentional word-splitting of the flow file list
        "${MAESTRO}" test -e APP_ID="${app}" ${files} && return 0
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
