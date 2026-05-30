# Offline behavior testing (Android E2E)

> [!NOTE] Offline/network-loss behavior is **not** currently exercised by the Android Maestro E2E
> suite. This is a deliberate, temporary removal — see the rationale below before reintroducing it.

## What was removed

- The two `maestro/offline-behavior/` flows (`recover-gracefully-when-network-restored` and
  `handle-rapid-network-state-changes`), which toggled the emulator's real network with
  `setAirplaneMode`.
- The defensive `setAirplaneMode: disabled` line that the variant flows used to clear any leftover
  airplane state — pointless once nothing enables airplane mode.
- The now-unused `simulate_offline` launch-arg plumbing in both demo apps (`compose`
  `MainActivity`/`MainScreen` and `views` `MainActivity`), which called `client.setOnline(false)` at
  startup. No flow ever passed it, so it was dead code.

## Why

The flows drove offline behavior by toggling the **emulator's real WiFi**
(`setAirplaneMode: enabled/disabled`). On a headless CI emulator the network is provided by netsim,
and **re-association after airplane mode is turned back off is nondeterministic** — sometimes it
takes well over 30 seconds. The flows identify immediately after restoring the network and assert
the identified state appears, so when the network had not actually recovered yet the identify call
never completed and the flow failed. This was the **last remaining source of flakiness** once the
real root cause of the chronic Android E2E instability was fixed (using the `aosp_atd` system image
instead of `google_apis`, whose Google Play Services and Pixel Launcher ANR on the software-GPU
emulator and overlay the app). No amount of retrying reliably fixes a network stack that genuinely
has not come back yet.

Crucially, offline handling lives in the shared **JS bridge**
(`packages/universal/optimization-js-bridge`), not in the thin Android native wrapper. The **iOS
native E2E suite already exercises the same bridge logic** — both native SDKs are thin wrappers over
the one bridge — so removing the flaky Android-emulator network toggling does not leave the offline
code path uncovered.

## How to reintroduce it properly

Do **not** toggle the emulator's real network (`setAirplaneMode` / `svc wifi`) — that is the flake
source. Instead drive the SDK's own offline state **deterministically**, so the test exercises the
SDK's offline code path without depending on emulator network recovery:

- Add an in-app online/offline control to the demo apps that calls `client.setOnline(false)` /
  `client.setOnline(true)` (e.g. a button tagged `network-toggle` plus a `network-status`
  indicator), and have the flows tap it; or
- Reuse a `simulate_offline`-style launch argument to start a flow with the SDK already offline,
  then relaunch online.

Either approach keeps the network itself up (so the mock at `10.0.2.2` stays reachable) while
putting the SDK through its offline → online transition, which is what these tests are actually
meant to verify.
