# Offline behavior testing (Android E2E)

**Status:** offline/network-loss behavior is not currently exercised by the Android Maestro E2E
suite — a deliberate, temporary removal. See the rationale below before reintroducing it.

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

The flows drove offline behavior by toggling the **emulator's real WiFi** (`setAirplaneMode`). On a
headless CI emulator the network is provided by netsim, and re-association after airplane mode is
turned back off is **nondeterministic** — it can take well over 30 seconds. The flows identify
immediately after restoring the network and assert the identified state appears, so when the network
has not actually recovered yet the identify never completes and the flow fails. No retry count
reliably fixes a network stack that genuinely has not come back.

Offline handling also lives in the shared **JS bridge**
(`packages/universal/optimization-js-bridge`), not in the thin Android native wrapper, and the iOS
native E2E suite already exercises that bridge logic — both native SDKs are thin wrappers over the
one bridge — so dropping the flaky Android-emulator network toggling does not leave the offline code
path uncovered.

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
