# Overview

This helpers module lets E2E tests simulate offline and online transitions on the device under test.
It exposes coarse toggles for full network connectivity (offline / online via an airplane-mode-style
switch) and finer toggles that only affect WiFi. Offline-behavior tests use these helpers to verify
that the SDK remains resilient when connectivity is lost and recovered.

## runAdbShell(command)

**Purpose:** Internal helper that sends a low-level command to the device under test and returns its
standard output.

**Inputs:**

- `command`: a list of tokens representing the command to run on the device.

**Returns / throws:** Resolves with the command's stdout as a string. Rejects if the device command
fails or the device is unreachable.

**Steps:**

1. Resolve the current target device identifier, if any.
2. Forward the command to that specific device, or to the default device when no identifier is
   available.
3. Capture and return the command's stdout.

## waitForAirplaneModeState(expectedEnabled, timeoutMs = 3000, pollMs = 200)

**Purpose:** Internal helper that polls the device's airplane / offline state until it matches the
expected value or the timeout elapses.

**Inputs:**

- `expectedEnabled`: the boolean offline state to wait for (`true` means the device is in airplane /
  offline mode).
- `timeoutMs`: maximum time to wait for the state transition. Defaults to `3000` ms.
- `pollMs`: interval between state checks. Defaults to `200` ms.

**Returns / throws:** Resolves with `true` if the state was observed within the timeout, otherwise
`false`. Does not throw on timeout.

**Steps:**

1. Compute the maximum number of attempts as `ceil(timeoutMs / pollMs)`.
2. For each attempt, call [isAirplaneModeEnabled](#isairplanemodeenabled) and return `true`
   immediately if it matches `expectedEnabled`.
3. Sleep `pollMs` between attempts.
4. After exhausting all attempts, return `false`.

## disableNetwork()

**Purpose:** Put the device into a fully offline state so the SDK observes a system-wide loss of
connectivity.

**Inputs:** None.

**Returns / throws:** Resolves once the device is offline or the fallback backoff has elapsed.

**Steps:**

1. Call [isAirplaneModeEnabled](#isairplanemodeenabled). If the device is already offline, return
   immediately (idempotency check).
2. Set the device to offline / airplane mode.
3. Notify the system that connectivity state changed, so listeners on the device receive the update.
4. Call
   [waitForAirplaneModeState](#waitforairplanemodestateexpectedenabled-timeoutms--3000-pollms--200)
   with `expectedEnabled = true` to confirm the transition within the default `3000` ms / `200` ms
   polling window.
5. If the transition could not be confirmed, sleep `300` ms as a fallback backoff before returning.

## enableNetwork()

**Purpose:** Restore full network connectivity on the device after a prior offline transition.

**Inputs:** None.

**Returns / throws:** Resolves once the device is back online or the fallback backoff has elapsed.

**Steps:**

1. Call [isAirplaneModeEnabled](#isairplanemodeenabled). If the device is already online, return
   immediately (idempotency check).
2. Set the device back to online mode.
3. Notify the system that connectivity state changed, so listeners on the device receive the update.
4. Call
   [waitForAirplaneModeState](#waitforairplanemodestateexpectedenabled-timeoutms--3000-pollms--200)
   with `expectedEnabled = false` to confirm the transition within the default `3000` ms / `200` ms
   polling window.
5. If the transition could not be confirmed, sleep `500` ms as a fallback backoff before returning.

## disableWifi()

**Purpose:** Disable WiFi on the device while leaving other network interfaces alone. Less reliable
for full offline simulation, since the device may still report connectivity through other
interfaces.

**Inputs:** None.

**Returns / throws:** Resolves after issuing the WiFi-off command and waiting the fallback settle
window.

**Steps:**

1. Instruct the device to turn its WiFi interface off.
2. Sleep `500` ms to let the WiFi state settle before returning.

## enableWifi()

**Purpose:** Re-enable WiFi on the device.

**Inputs:** None.

**Returns / throws:** Resolves after issuing the WiFi-on command and waiting the fallback settle
window.

**Steps:**

1. Instruct the device to turn its WiFi interface on.
2. Sleep `1000` ms to let the WiFi state settle and reassociate before returning.

## isAirplaneModeEnabled()

**Purpose:** Report whether the device is currently in the offline / airplane mode state.

**Inputs:** None.

**Returns / throws:** Resolves with `true` if the device is offline, otherwise `false`.

**Steps:**

1. Query the device for its current offline / airplane mode setting.
2. Return `true` when the returned value indicates the offline state, otherwise `false`.
