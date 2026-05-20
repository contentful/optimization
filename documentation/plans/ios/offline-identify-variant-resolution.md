# Offline identify never resolves the identified variant after going back online

## Summary

When `identify` is called while the iOS app is in simulated-offline mode, the SDK enqueues the
resulting Experience event into an **in-memory-only** offline queue and does not persist it. The iOS
`goOnline()` / `goOffline()` test helpers go online by **terminating and relaunching** the app,
which destroys that in-memory queue along with the JavaScript context, so the queued offline
identify is lost before it can ever flush. The identified profile is therefore never upserted to the
Experience API, the server never returns the identified `OptimizationData`, and the identified
nested variant `entry-text-2KIWllNZJT205BwOSkMINg` never resolves on the post-relaunch screen.

## Affected tests

- `OfflineBehaviorTests.testContinuesToTrackEventsWhileOffline`
  (`implementations/ios-sdk/uitests/Tests/OfflineBehaviorTests.swift:71`)
- `OfflineBehaviorTests.testQueueEventsOfflineAndFlushWhenOnline`
  (`implementations/ios-sdk/uitests/Tests/OfflineBehaviorTests.swift:162`)

Both fail with
`No matches found for Elements matching predicate '"entry-text-2KIWllNZJT205BwOSkMINg" IN identifiers'`
after the offline-identify -> online -> relaunch sequence.

## Evidence

From `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`:

`testContinuesToTrackEventsWhileOffline` (lines 2640-2887). The accessibility snapshot at failure
(lines 2800-2885) shows the relaunched app rendered the **anonymous baseline** entry, not the
identified variant:

```
Other, identifier: 'entry-text-1JAU028vQ7v6nB2swl3NBo',
  label: 'This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]',
...
Button, identifier: 'identify-button', label: 'Identify',
```

The `identify-button` is still present and the level-0 entry is the baseline
`1JAU028vQ7v6nB2swl3NBo` — proof the SDK rehydrated an **anonymous** profile after the relaunch. The
identified variant `entry-text-2KIWllNZJT205BwOSkMINg` is absent from the snapshot entirely.

`testQueueEventsOfflineAndFlushWhenOnline` fails identically (lines 3112, 3199).

### Contrast: the online-identify cases pass

The same suite's two tests that identify while **online** both pass:

- `testHandleRapidNetworkStateChanges` passed (line 2951) — toggles network but taps
  `identify-button` only after the final `goOnline()` relaunch.
- `testRecoverGracefullyWhenNetworkRestored` passed (line 3256) — the log shows
  `Tap "identify-button"` at `t = 20.89s` (line 3236), which is _after_ the `goOnline()` relaunch at
  `t = 15.52s`, so the identify runs against an online SDK. The post-relaunch
  `entry-text-2KIWllNZJT205BwOSkMINg` check then succeeds.

`IdentifiedVariantsTests` (a separate suite, `setUp` at `IdentifiedVariantsTests.swift:14`) also
identifies while online and then relaunches; `testShouldDisplayLevel0NestedVariantForReturnVisitors`
passed (line 1419), confirming that level-0 nested variant resolution and the identify -> persist ->
relaunch -> rehydrate flow work for the online case.

The only behavioral difference between the passing and failing tests is whether `identify` is tapped
while the app is offline. That isolates the defect to the offline-identify path.

## Root cause analysis

The offline identify is dropped because the offline queue is in-memory and the iOS test goes
"online" by relaunching the process.

1. `MainScreen.swift:68` (`uikit/Screens/MainViewController.swift` mirrors this): when launched with
   `--simulate-offline`, the app calls `client.setOnline(false)`.

2. `OptimizationClient.setOnline` (`OptimizationClient.swift:184`) forwards to the JS bridge
   `setOnline`, which sets `onlineSignal.value = false` in the JS core (`CoreStateful.online`
   setter, `CoreStateful.ts:358`).

3. The test taps `identify-button`. `MainScreen.handleIdentify` (`MainScreen.swift:98`) calls
   `client.identify` -> `CoreStatefulEventEmitter.identify` (`CoreStatefulEventEmitter.ts:127`) ->
   `sendExperienceEvent` (`CoreStatefulEventEmitter.ts:307`) -> `ExperienceQueue.send`
   (`ExperienceQueue.ts:101`).

4. `ExperienceQueue.send` sets `eventSignal.value = validEvent` (so the in-app analytics counter
   increments — this is why the offline `events-count` assertion still passes), then checks
   `onlineSignal.value`. Because it is `false`, it takes the offline branch:
   `this.enqueueEvent(validEvent)` and `return undefined` (`ExperienceQueue.ts:107-112`). **No
   `upsertProfile` is called, so the identified profile is never produced.**

5. `enqueueEvent` (`ExperienceQueue.ts:149`) only adds the event to the in-memory
   `private readonly queuedExperienceEvents = new Set<ExperienceEventPayload>()`
   (`ExperienceQueue.ts:66`). This `Set` lives entirely inside the JavaScriptCore context. It is
   never written to `UserDefaults`.

6. `UserDefaultsStore` (`UserDefaultsStore.swift:18`) persists only `profile`, `consent`, `changes`,
   `personalizations`, `anonymousId`, and `debug`. There is no persisted "pending Experience events"
   key. The profile is only written by `OptimizationClient.handleStateUpdate`
   (`OptimizationClient.swift:442`), which fires from the JS `onStateChange` effect — and that
   effect only emits an identified profile after `updateOutputSignals` runs with server
   `OptimizationData`. Offline, `updateOutputSignals` never runs.

7. The test's `goOnline()` helper (`OfflineBehaviorTests.swift:65`) does `app.terminate()` then
   `app.launch()`. Terminating the app tears down the JavaScriptCore context and the entire
   `ExperienceQueue` instance, including the in-memory `queuedExperienceEvents` Set. **The offline
   identify event is destroyed at this point.** It is never flushed.

8. The relaunched app calls `store.load()` in `OptimizationClient.initialize`
   (`OptimizationClient.swift:86`). It rehydrates only the anonymous profile that was persisted
   before the offline identify. `NetworkMonitor` (`NetworkMonitor.swift`) flips `onlineSignal` to
   `true` and the `effect` in `CoreStateful.initializeEffects` (`CoreStateful.ts:307-313`) calls
   `flushQueues({ force: true })`, but `ExperienceQueue.flush` finds
   `queuedExperienceEvents.size === 0` (`ExperienceQueue.ts:120`) and returns immediately. There is
   nothing to flush.

9. With no identified profile, the post-relaunch screen renders the anonymous baseline, and
   `entry-text-2KIWllNZJT205BwOSkMINg` never appears.

The in-process flush path in `CoreStateful` (the `online` effect calling `flushQueues`, and
`NetworkMonitor` calling `client.flush()` on reconnect) only works when the app **stays alive**
across the offline -> online transition. The iOS offline simulation is process-relaunch based, so
the in-memory queue cannot survive the transition. RN does not hit this because it toggles **real**
network state on a single long-lived process (see below), so its in-memory queue is intact when
connectivity returns.

## Reference: expected behavior

`implementations/react-native-sdk/e2e/offline-behavior-pseudocode.md` defines the contract. Test
"should queue events offline and eventually flush when online":

> Events generated while offline are tracked locally; after reconnect the queued identify flushes to
> the Experience API end to end, so a relaunched app resolves the identified-only nested variant and
> shows the `reset-button`.

The RN/Detox suite toggles **real** device connectivity with adb airplane mode (`disableNetwork` /
`enableNetwork` in `networkHelpers.js`). The app process stays alive across the offline -> online
transition, so the in-memory `ExperienceQueue` still holds the queued offline identify when
`onlineSignal` flips back to `true`, the `CoreStateful` online effect flushes it, the server returns
the identified `OptimizationData`, and the identified profile is then persisted before the test's
own relaunch. The contract assumes the offline queue is alive at the moment connectivity is
restored.

The iOS suite cannot toggle runtime network state under XCUITest, so it simulates offline by
relaunching with `--simulate-offline`. That design choice breaks the contract's implicit assumption:
on iOS the "go online" step destroys the process (and the queue) instead of just flipping
connectivity. Either the offline queue must be made durable across launches, or the iOS test must
perform the offline -> online transition without terminating the app.

## Fix plan

The cleanest fix that keeps the test honest (a real offline identify that genuinely flushes after
reconnect) is to make the iOS offline simulation a runtime toggle rather than a process relaunch, so
the in-memory `ExperienceQueue` survives the transition exactly as it does on RN. Persisting the
offline queue is an alternative but is a larger, cross-platform SDK change.

### Option A (recommended): make iOS offline simulation a runtime toggle

1. In `implementations/ios-sdk/swiftui/Screens/MainScreen.swift` and
   `implementations/ios-sdk/uikit/Screens/MainViewController.swift`, add a runtime-controllable
   offline switch instead of (or in addition to) the launch-argument check. Add a hidden test-only
   control — e.g. buttons with accessibility identifiers `simulate-offline-button` and
   `simulate-online-button` — that call `client.setOnline(false)` / `client.setOnline(true)` on the
   already-running process. Gate these controls behind a launch argument such as
   `--enable-network-controls` so they only exist under UI test.

2. In `implementations/ios-sdk/uitests/Tests/OfflineBehaviorTests.swift`, rewrite `goOffline()` /
   `goOnline()` to tap those buttons on the live app instead of calling `app.terminate()` +
   `app.launch()`. Keep the final `app.terminate()` + `app.launch()` that each test already performs
   _after_ the online flush window, so the assertion still proves the identified profile survived a
   genuine cold start.

3. With this change the offline identify is enqueued, the app stays alive, the test taps
   `simulate-online`, `setOnline(true)` flips `onlineSignal`, the `CoreStateful` online effect
   (`CoreStateful.ts:307`) flushes `ExperienceQueue` (`ExperienceQueue.ts:115`), `upsertProfile`
   runs, the server returns the identified `OptimizationData`, `updateOutputSignals` updates
   `profileSignal`, `OptimizationClient.handleStateUpdate` persists the identified profile, and the
   subsequent relaunch rehydrates it.

4. No iOS SDK or JS core change is required for Option A — the `ExperienceQueue` reconnect-flush
   path already works for a live process. This is purely an iOS app-shell + test change.

### Option B (alternative): persist the offline Experience queue

If the offline simulation must remain relaunch-based, the offline queue has to become durable:

1. In `packages/universal/core-sdk/src/queues/ExperienceQueue.ts`, expose a way to serialize
   `queuedExperienceEvents` and to rehydrate it on construction. Add a hydrate hook so
   `CoreStateful` can seed the queue from persisted state, and a change notification so the host can
   persist after each `enqueueEvent`.

2. In `packages/universal/core-sdk/src/CoreStateful.ts`, thread a new
   `defaults.queuedExperienceEvents` (or similar) into the `ExperienceQueue` constructor, and emit
   queue-changed events the host can observe.

3. In the iOS SDK, persist the queued events: add a `queuedExperienceEvents` key to
   `PersistentStore` / `UserDefaultsStore`
   (`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/`), load it in
   `OptimizationClient.initialize` (`OptimizationClient.swift:76`), pass it into the bridge config,
   and write it back whenever the queue changes (mirroring `handleStateUpdate`).

4. Mirror the same bridge plumbing in `packages/ios/ios-jsc-bridge/src/index.ts` (and the Android
   bridge for parity).

Option B is a cross-cutting SDK + bridge change touching the JS core, both native SDKs, and storage,
and would need its own queue-persistence test coverage.

### Relationship to variant-nested resolution

This failure is **independent** of any nested-variant resolution defect: the online-identify tests
(`testRecoverGracefullyWhenNetworkRestored`,
`IdentifiedVariantsTests.testShouldDisplayLevel0NestedVariantForReturnVisitors`) resolve
`entry-text-2KIWllNZJT205BwOSkMINg` correctly, proving level-0 nested variant resolution works once
an identified profile is present. The fix here does not depend on the variant-nested issue tracked
in [variant-nested-children-stripped](./variant-nested-children-stripped.md) (if that sibling
document exists); the two should be fixed and verified separately.

## Risks and open questions

- Option A changes the app shell only for test builds; confirm the `--enable-network-controls` gate
  keeps the extra buttons out of normal runs and does not perturb other suites'
  accessibility-hierarchy snapshots.
- Option A's `goOnline()` must allow enough settle time after tapping `simulate-online` for the
  reconnect flush round-trip to land; the existing `QUEUE_FLUSH_GRACE_MS` (10000 ms) should remain
  sufficient since the process is no longer being torn down mid-flush.
- `NetworkMonitor` (`NetworkMonitor.swift`) reflects **real** simulator connectivity. Under
  `--simulate-offline`, the app sets `setOnline(false)` at launch but `NetworkMonitor` may
  immediately flip it back to `true` if the simulator has real network — verify whether the
  launch-argument offline state is actually held, or whether `NetworkMonitor` races against it. If
  `NetworkMonitor` overrides the simulated-offline state, the offline branch in
  `ExperienceQueue.send` may not even be taken, which would be a second contributing defect; Option
  A's runtime toggle would need `NetworkMonitor` suppressed while a manual offline override is
  active.
- Confirm the RN suite genuinely keeps one process alive across the offline -> online transition (it
  should, via airplane-mode toggling) so the cross-platform contract stays consistent after the iOS
  fix.

## Related files

- `implementations/ios-sdk/uitests/Tests/OfflineBehaviorTests.swift`
- `implementations/ios-sdk/uitests/Tests/IdentifiedVariantsTests.swift`
- `implementations/ios-sdk/swiftui/Screens/MainScreen.swift`
- `implementations/ios-sdk/uikit/Screens/MainViewController.swift`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/UserDefaultsStore.swift`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Storage/PersistentStore.swift`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Handlers/NetworkMonitor.swift`
- `packages/ios/ios-jsc-bridge/src/index.ts`
- `packages/universal/core-sdk/src/queues/ExperienceQueue.ts`
- `packages/universal/core-sdk/src/CoreStateful.ts`
- `packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts`
- `implementations/react-native-sdk/e2e/offline-behavior-pseudocode.md`
- `implementations/react-native-sdk/e2e/offline-behavior.test.js`
- `implementations/react-native-sdk/e2e/networkHelpers.js`
- Test log: `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`
