#!/usr/bin/env bash
#
# ci-anr-watchdog.sh - Reactively clear Pixel Launcher ANR dialogs during a CI Maestro run.
#
# On the headless software-GPU CI emulator the Pixel Launcher intermittently ANRs during
# the clearState->home->relaunch transition between flows. Its system "isn't responding"
# dialog then floats on top of the app under test, so Maestro's accessibility queries
# resolve against the dialog window and every subsequent flow fails (e.g. "identify-button
# is visible" assertion false) even though the app rendered fine behind it.
#
# We cannot cleanly PREVENT the ANR: disabling the launcher leaves
# com.android.settings.FallbackHome busy-looping ("User unlocked but no home...") and
# destabilises the emulator. So we clear it REACTIVELY: when ActivityManager logs an ANR
# for the launcher, force-stop it. The dialog disappears immediately and the launcher is
# restarted as home on the next transition. Maestro's built-in auto-waiting tolerates the
# ~1-2s blip. systemui ANRs are handled the same way (its dialog also overlays the app).
#
# Runs until killed (the emulator-runner tears it down at job end). Intended to be started
# in the background before the Maestro suite. Local equivalent emulators have a hardware
# GPU and do not hit this, so run-e2e.sh does not start it.

set -uo pipefail

LAUNCHER="com.google.android.apps.nexuslauncher"
SYSTEMUI="com.android.systemui"

# `logcat -e <regex>` emits only matching lines; every line that arrives here is an ANR
# report for the launcher or systemui, so act on each one.
adb logcat -v brief -e "ANR in (${LAUNCHER}|${SYSTEMUI})" 2>/dev/null | while IFS= read -r line; do
    echo "[anr-watchdog] $(date -u '+%H:%M:%S') clearing launcher ANR dialog: ${line}"
    adb shell am force-stop "${LAUNCHER}" >/dev/null 2>&1 || true
done
