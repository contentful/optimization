# iOS view-tracking timing and app-lifecycle failures

## Summary

Three `ExtendedViewTrackingTests` fail because the iOS `ViewTrackingController` cycle state machine
and the XCUITest scroll/lifecycle mechanics interact badly. `testDurationResetOnNewCycle` and
`testNoEventsBeforeDwellThreshold` are primarily **test-mechanism timing problems**: the iOS
`scrollToElement` / `swipeDown(times:)` mechanics keep the tracked entry on screen long enough (or
move it off screen) in ways the pseudocode contract did not anticipate, so the events the test
counts are not the events it assumes. `testPauseResumeOnBackgroundForeground` exposes a **genuine
iOS SDK lifecycle bug**: after the app foregrounds, the `ViewTrackingController.resume()` path does
not produce a new initial event, because the SwiftUI `@State`-held controller plus the
`.onGeometryChange`-driven `updateVisibility` contract means `resume()` re-evaluates stale geometry
and there is no fresh geometry callback after `app.activate()`.

## Affected tests

- `implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift` —
  `testDurationResetOnNewCycle` (line ~232, assertion line 242)
- `implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift` —
  `testNoEventsBeforeDwellThreshold` (line ~120, assertion line 137)
- `implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift` —
  `testPauseResumeOnBackgroundForeground` (line ~194, fails at
  `implementations/ios-sdk/uitests/Support/TestHelpers.swift:61` via `waitForComponentEventCount`)

## Failure 1: testDurationResetOnNewCycle

### Evidence

Test log `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log` lines 65-102:

```
t = 3.38s  app becomes Running Foreground
t = 5.61s  "Analytics Events" StaticText exists
t = 5.75s  Swipe up "main-scroll-view" ScrollView   (scrollToElement, 1st swipe)
t = 8.35s  ... event-count element checks
t = 9.71s  Find the "event-duration-1MwiFl4z7gkwqGYdvCmr8c" StaticText
ExtendedViewTrackingTests.swift:242: error: XCTAssertGreaterThan failed:
  ("3418") is not greater than ("4000")
```

The duration read after the count reached 2 is consistently ~3418-3524ms, never the ~7000ms the
two-events-into-a-single-cycle timing model predicts.

### Root cause analysis

The expected timing model for a continuously visible entry (per
`packages/ios/.../Tracking/ViewTrackingController.swift` `scheduleNextFire`):

- `onBecameVisible` at `T0`: `accumulatedMs = 0`, `attempts = 0`, schedules fire.
- `requiredMs = viewTimeMs + attempts * viewDurationUpdateIntervalMs = 2000 + 0 = 2000` → initial
  event at `T0 + ~2000`, `viewDurationMs ~= 2000`, `attempts -> 1`.
- Next `requiredMs = 2000 + 1 * 5000 = 7000` → periodic event at `T0 + ~7000`,
  `viewDurationMs ~= 7000`.

So a real initial + periodic pair inside one cycle would report ~7000ms, which clears the `> 4000`
contract. The test instead reads ~3418ms, which is _less than_ the periodic value and _more than_
the dwell threshold. That value is the duration of a **final event**, not a periodic one.

The mechanism: the tracked entry `1MwiFl4z7gkwqGYdvCmr8c` is the **first** entry in the list
(`implementations/ios-sdk/shared/Config.swift` `entryIds[0]`) and is the entry visible on launch.
`waitForComponentEventCount(VISIBLE_ENTRY_ID, minCount: 2, ...)` first calls `scrollToElement`
(`implementations/ios-sdk/uitests/Support/TestHelpers.swift:122`), which `swipeUp()`s
`main-scroll-view` to bring `event-count-1MwiFl4z7gkwqGYdvCmr8c` (rendered far below all 8 entries
inside `AnalyticsEventDisplay`, see `implementations/ios-sdk/swiftui/Screens/MainScreen.swift:58`)
into view.

That swipe-up scrolls the first entry **out of the viewport**. `ViewTrackingModifier`'s
`.onGeometryChange` then calls `updateVisibility` with a visibility ratio below `threshold`,
triggering `onBecameInvisible()`, which (since `attempts > 0` after the initial event) calls
`emitEvent()` as a **final event**. So the count reaches 2 as `initial(1) + final(2)` rather than
`initial(1) + periodic(2)`. The final event's `viewDurationMs` is `accumulatedMs` measured from
`onBecameVisible` to the swipe — roughly the 2000ms dwell plus the ~1.4s the entry stayed on screen
before the t=5.75s swipe scrolled it away ≈ 3418ms.

Net: this is a **test-mechanism timing issue**, not an SDK duration bug. The iOS duration
accumulation in `ViewTrackingController.flushAccumulatedTime` / `emitEvent` is correct; the test
just counts the wrong second event because the scroll-to-stats action ends the cycle before the
periodic event fires. The `> 4000` numeric assertion is correct per the pseudocode contract and must
not be weakened — the fix is to let the entry actually accumulate two in-cycle events before
scrolling it away.

### Fix plan

1. In `ExtendedViewTrackingTests.testDurationResetOnNewCycle`
   (`implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift`), do not let the first
   `waitForComponentEventCount(..., minCount: 2, ...)` be the thing that scrolls the tracked entry
   off screen. Two viable test-side approaches, in order of preference:
   - Preferred: keep the tracked entry on screen while still polling the stats. The stats live below
     all entries in the same `OptimizationScrollView`, so any scroll that reveals the stats hides
     entry 0. Instead, poll the count by reading `event-count-<id>` text repeatedly _after_ a single
     scroll, but anchor the duration read on a count that is reached by genuine periodic
     progression: wait for `minCount >= 3` (initial + periodic + the unavoidable final from the
     scroll) and read duration from the **periodic** event, or read `event-duration` immediately
     before the count-2 scroll happens.
   - Alternative: split the dwell. Wait `EXTENDED_TIMEOUT` for `minCount: 2` _without_ relying on
     `scrollToElement` — e.g. read the count via a helper that does not swipe entry 0 out, then
     scroll only once at the end to read duration.
2. Add a helper in `implementations/ios-sdk/uitests/Support/TestHelpers.swift` (e.g.
   `waitForComponentEventCountWithoutScroll`) that polls `event-count-<id>` text but performs the
   reveal scroll only once and tolerates the entry being off screen, so the count-2 milestone is
   reached by a real periodic event firing in the background rather than by the final event the
   reveal scroll induces.
3. Confirm against the contract: `extended-view-tracking-pseudocode.md` step 4 specifies
   `firstCycleDuration > 4000`. Do not lower this. The fix must make the test observe a genuine
   second in-cycle event whose `viewDurationMs ~= 7000`.
4. Verify by re-running `testDurationResetOnNewCycle` and `testIncreasingViewDurationMs` (the latter
   only asserts `> 2000` and currently passes, so it is a good regression guard that the scroll
   change did not break the simpler case).

## Failure 2: testNoEventsBeforeDwellThreshold

### Evidence

Test log lines 458-500:

```
t = 5.69s  Checking existence of content-entry-7pa5bOx8Z9NmNcr7mISvD
t = 5.77s  Find the "content-entry-7pa5bOx8Z9NmNcr7mISvD" Other  (scrollToElement returned)
t = 5.80s  Swipe down "main-scroll-view"   (1 of 3)
t = 6.78s  Swipe down "main-scroll-view"   (2 of 3)
t = 7.75s  Swipe down "main-scroll-view"   (3 of 3)
t = 11.72s Waiting 2.0s for "entry-stats-7pa5bOx8Z9NmNcr7mISvD" Other to exist
ExtendedViewTrackingTests.swift:137: error: XCTAssertFalse failed
```

`scrollToElement` found `content-entry-7pa5bOx8Z9NmNcr7mISvD` already on the _first_ iteration (no
swipe up logged before t=5.77s — the entry was visible after only the launch settle), then the three
`swipeDown` calls scroll it back up. The `entry-stats` element for the below-fold entry nonetheless
exists, meaning a `component` view event fired.

### Root cause analysis

The contract (`extended-view-tracking-pseudocode.md`, "should emit zero events when entry scrolls
out before dwell threshold") assumes the below-fold entry is on screen for _well under_ 2000ms. On
iOS that assumption does not hold because of two compounding mechanics:

1. `scrollToElement` (`TestHelpers.swift:122`) loops `maxSwipes` times doing one `swipeUp()` per
   iteration and returns as soon as the target `exists && isHittable`. Each XCUITest swipe is not
   instantaneous: the log shows each swipe plus its `Wait for ... to idle` consumes ~1 second.
   `BELOW_FOLD_ENTRY_ID = 7pa5bOx8Z9NmNcr7mISvD` is `entryIds[6]` — entry index 6 of 8. Bringing it
   into view and then doing three `swipeDown(times:3)` swipes back is several seconds of wall time
   during which the entry passes through, and can _rest in_, the viewport.

2. `swipeDown(times:3)` is a coarse gesture. A `swipeUp`/`swipeDown` in XCUITest is a large
   fixed-velocity fling; SwiftUI scroll deceleration and the `.onGeometryChange` sampling mean the
   entry can sit at `visibilityRatio >= 0.8` across more than one geometry callback. If the entry is
   `>= 0.8` visible continuously for ~2000ms of accumulated time across the scroll-in / settle /
   scroll-out sequence, `ViewTrackingController` legitimately fires the initial event. The
   accumulation in `flushAccumulatedTime` is cumulative wall-clock time visible, and the iOS scroll
   gestures here total well over 2 seconds.

The SDK behavior is **correct**: it fires an initial event because the entry genuinely _was_ visible
(at `>= 0.8` ratio) for at least the dwell threshold. The RN suite passes the equivalent test
because RN's `scrollToElement` uses small, repeatable 300-unit increments (pseudocode step 2 says
"in increments of 300 units") and RN scroll is driven by precise `scrollTo` offsets, so the
below-fold entry flicks past the viewport quickly and never dwells `>= 0.8` for 2000ms. The iOS
`swipeUp()`/`swipeDown` fling-based mechanics cannot reproduce that short, controlled exposure.

This is a **test-mechanism limitation**, not an SDK bug. The pseudocode contract is about whether
zero events fire for a sub-dwell exposure; on iOS the test does not actually produce a sub-dwell
exposure.

### Fix plan

1. Replace the fling-based scrolling in `testNoEventsBeforeDwellThreshold` with a controlled,
   short-exposure scroll. Add an increment-based scroll helper in `TestHelpers.swift` that mirrors
   the RN "300 units" contract — e.g. `scrollByOffset(scrollViewId:dy:app:)` using
   `XCUIElement.scroll(byDeltaX:deltaY:)` (macOS) or a precise `press(forDuration:thenDragTo:)`
   small drag, so the below-fold entry passes through the viewport quickly without dwelling.
2. In the test, scroll the below-fold entry just barely into view and immediately scroll it back, so
   its total `>= 0.8`-visible time stays well under 2000ms. The goal is to honor the pseudocode
   intent (sub-dwell exposure) rather than to weaken the `XCTAssertFalse` assertion.
3. If a precise small-scroll primitive is not feasible with the current XCUITest scroll surface, the
   fallback is to choose a `BELOW_FOLD_ENTRY_ID` that requires only a single small swipe to touch
   the viewport edge, minimizing dwell — but the increment-based helper is preferred for parity with
   the RN contract.
4. Do not weaken the assertion. The contract says zero events for a sub-dwell exposure; the fix must
   make the iOS test actually create a sub-dwell exposure.
5. Verify with `testNoEventsBeforeDwellThreshold` and confirm
   `testPeriodicEventsForContinuously- VisibleEntry` still passes (guards that the new scroll helper
   did not accidentally suppress legitimate events).

## Failure 3: testPauseResumeOnBackgroundForeground

### Evidence

Test log lines 501-1062:

```
t = 12.28s Pressing Home button
t = 13.76s Activate com.contentful.optimization.app.swiftui   (app.activate)
t = 13.94s Swipe up "main-scroll-view"   (scrollToElement begins)
... 10 more swipe-up iterations, every ~1.1s, through t = 27.66s ...
TestHelpers.swift:61: error: ... Timed out waiting for text condition on
  "event-count-1MwiFl4z7gkwqGYdvCmr8c". Last text: "Count: 2"
```

Before backgrounding the count was 2 (`countBeforeBackground = 2`). The test waits for
`countBeforeBackground + 2 = 4`. After foreground the count never advances past 2 for the full
`EXTENDED_TIMEOUT` (30s) — failure at 66.6s total. So neither the final event from the paused cycle
nor a new-cycle initial event landed.

### Root cause analysis

This is a **genuine iOS SDK lifecycle bug**. `ViewTrackingController`
(`packages/ios/.../Tracking/ViewTrackingController.swift`) registers
`UIApplication.didEnterBackgroundNotification` → `pause()` and
`UIApplication.didBecomeActiveNotification` → `resume()` in `init`. There are two distinct problems:

**Problem A — the final event on background may not be observed.** `pause()` calls
`pauseAccumulation()`, invalidates the timer, and if `attempts > 0` calls `emitEvent()`.
`emitEvent()` dispatches `Task { try? await client.trackView(payload) }`. When the app is entering
the background, the analytics pipeline and the `EventStore` subscription
(`implementations/ios-sdk/shared/EventStore.swift`) may not flush/deliver before the process is
suspended. `AppStateHandler.handleWillResignActive`
(`packages/ios/.../Handlers/AppStateHandler.swift`) does call `client.flush()`, but
`willResignActive` and `didEnterBackground` are separate notifications with no ordering guarantee
relative to the controller's `pause()`. The final `component` event may be emitted but not delivered
to `EventStore.componentStats` before suspension, and on resume `EventStore` is the same in-memory
singleton (`requireFreshAppInstance` is **not** passed for this test — it resumes, not relaunches),
so a dropped final event simply never appears. This yields "count stays at 2".

**Problem B — `resume()` re-evaluates stale geometry and `isVisible` flips, but no fresh cycle
starts in practice.** `resume()` sets `isVisible = false` and calls `updateVisibility(...)` with the
last stored geometry (`lastElementY`, `lastElementHeight`, `lastScrollY`, `lastViewportHeight`). For
that to start a new cycle, the recomputed `visibilityRatio` must be `>= threshold`. But the stored
geometry was last written by the most recent `.onGeometryChange` callback _before backgrounding_. In
`testPauseResumeOnBackgroundForeground` the sequence before `press(.home)` is: the test ran
`waitForComponentEventCount(minCount: 1)` then `minCount: 2`, each of which calls `scrollToElement`
and `swipeUp`s `main-scroll-view` to reveal the stats. By the time the app is backgrounded, the
**last geometry the controller saw put entry 0 off screen** (scrolled up out of the viewport so the
stats are visible). So `resume()`'s `updateVisibility` recomputes `visibilityRatio < threshold` and
does **not** call `onBecameVisible()` — no new cycle, no initial event.

Then, after `app.activate()`, the test's `scrollToElement` swipes the scroll view. Those swipes _do_
drive `.onGeometryChange` again. But by then entry 0 is far above the viewport (stats are being
scrolled to), so it never re-enters `>= 0.8` visibility. The new cycle's initial event the test
expects (count 3 → 4) requires entry 0 to dwell visible for 2000ms again, which never happens
because the test only ever scrolls _toward_ the stats, away from entry 0.

The deeper structural problem: `resume()`'s "re-evaluate from stored geometry" only works if the
element was visible at background time. The recent change to `resume()` (re-evaluating from stored
geometry instead of waiting for a geometry callback) does not help when the stored geometry says
"not visible" — which is exactly the state this test leaves the controller in. And the RN suite
passes the equivalent test because in RN the `AppState` `active` branch calls `checkVisibility()`
against `dimensionsRef` + live `scrollY`, and the RN test flow keeps the entry's geometry such that
it re-resolves visible; more importantly RN's pseudocode step 10 says "Relaunch the app without
resetting state" — `requireFreshAppInstance` semantics differ, and on a true relaunch the whole view
hierarchy re-mounts and re-runs `onAppear` → `performVisibilityCheck` with the entry at the top,
naturally starting a fresh cycle.

Note the iOS test uses `app.activate()` (resume the existing process), **not** a relaunch. The
pseudocode contract step 10 ("Relaunch the app without resetting state") is ambiguous and the iOS
test interpreted it as a background/foreground resume. A resumed SwiftUI process does **not**
re-mount the view hierarchy, so `ViewTrackingModifier.onAppear` does not re-fire and there is no
fresh geometry callback for the still-mounted entry 0. The controller is entirely dependent on
`resume()` for the new cycle, and `resume()` cannot start one because (a) stored geometry says
not-visible and (b) even if it were visible, `onBecameVisible` schedules a timer that needs 2000ms
of `accumulatedMs`, which is fine — the blocker is (a).

Summary: Problem B is a real SDK gap — `resume()` cannot recover a cycle when the element was off
screen at background time and nothing scrolls it back into `>= 0.8` view afterwards. Problem A is a
real (if intermittent) delivery gap for the final event. The test mechanics also contribute:
scrolling only toward the stats means entry 0 is never re-shown after foreground.

### Fix plan

1. **SDK — make the final-event delivery on background reliable.** In
   `ViewTrackingController.pause()` (`packages/ios/.../Tracking/ViewTrackingController.swift`), the
   final `emitEvent()` already runs synchronously up to the `Task { await client.trackView }` hop.
   Coordinate it with `AppStateHandler` so the flush happens _after_ all controllers have emitted
   their final events: have `pause()` emit synchronously into the client's queue, and ensure
   `AppStateHandler.handleWillResignActive`'s `client.flush()` runs after background `pause()`
   calls. Consider using a `UIApplication` background task assertion (`beginBackgroundTask`) around
   the flush so the final `component` event is delivered before suspension, mirroring how analytics
   flush-on-background is normally hardened.
2. **SDK — make `resume()` able to start a fresh cycle even when stored geometry is stale or says
   not-visible, when the element is in fact still mounted and on screen.** Two options:
   - Have `ViewTrackingModifier` (`packages/ios/.../Tracking/ViewTrackingModifier.swift`) trigger an
     explicit geometry re-check on `didBecomeActive` — e.g. read the current
     `.named(ScrollContext.coordinateSpaceName)` frame on foreground and call
     `controller.updateVisibility(...)` with _fresh_ geometry rather than relying on the
     controller's stored values. The modifier already owns `performVisibilityCheck`; wire a
     foreground notification (or a `scenePhase` `@Environment`) to call it.
   - Or have `OptimizationScrollView` re-emit its `ScrollOffsetPreferenceKey` / viewport-height
     preference on foreground so descendant `.onGeometryChange` modifiers re-fire naturally.
3. **SDK — clarify the contract of `resume()`** so it does not silently no-op. If stored geometry is
   older than the background transition, `resume()` should defer to the next real geometry callback
   rather than make a decision from stale data; the foreground re-check from step 2 then becomes the
   authoritative path.
4. **Test — keep entry 0 observable across the background/foreground cycle.** In
   `testPauseResumeOnBackgroundForeground`
   (`implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift`), the test currently
   establishes the cycle (which scrolls entry 0 off screen to read the stats), then backgrounds.
   After foreground it only scrolls _toward_ the stats again, so entry 0 never re-dwells. Adjust the
   test so that after `app.activate()` it first scrolls back to the top so entry 0 is visible again
   (giving the resumed controller a real `>= 0.8` cycle to track), _then_ scrolls to the stats to
   read the count. This makes the new-cycle initial event achievable once the SDK fix in steps 2-3
   lands.
5. **Decide relaunch vs. resume.** Reconcile the iOS test with the pseudocode contract step 10
   ("Relaunch the app without resetting state"). If the contract intends a true relaunch, the iOS
   test should relaunch with the same persisted profile (so `EventStore` resets but the new mount
   naturally starts a fresh cycle from `onAppear`) instead of `XCUIDevice.shared.press(.home)` +
   `app.activate()`. If it intends a background/foreground resume, steps 1-4 above are required.
   Note `EventStore.shared` is an in-memory singleton, so a true relaunch resets the count to 0 and
   `countBeforeBackground + 2` would need to be re-derived; the resume interpretation is more
   faithful to "without resetting state" and is the recommended target — but it depends on the SDK
   fixes in steps 1-3.
6. Verify with `testPauseResumeOnBackgroundForeground`, and re-run `testFinalEventOnScrollOut` and
   `testFinalEventOnNavigationUnmount` (both currently pass and exercise the final-event path) to
   confirm the `pause()`/flush coordination change did not regress non-background final events.

## Risks and open questions

- **Failure 1 / Failure 2 share a root mechanism**: iOS XCUITest `swipeUp`/`swipeDown` flings are
  coarse and slow compared to RN's precise offset scrolling. Both fixes hinge on introducing a
  controlled, increment-based scroll primitive for `main-scroll-view`. It is worth building one
  shared `scrollByOffset` helper in `TestHelpers.swift` and migrating both tests, rather than two ad
  hoc fixes. Open question: whether XCUITest on the SwiftUI scroll surface exposes a precise-enough
  scroll API (`scroll(byDeltaX:deltaY:)` is macOS-only; on iOS a measured
  `press(forDuration:thenDragTo:)` drag is the likely primitive and needs validation).
- **Failure 3 final-event delivery (Problem A)** may be intermittent — the log shows the count stuck
  at exactly 2, which is consistent with _both_ the final event being dropped _and_ the new cycle
  never starting. If only Problem B is fixed, the count might reach 3 (new initial) but not 4
  (missing final); if only Problem A is fixed, it might reach 3 (final delivered) but not 4. Both
  SDK fixes are likely needed to reach `countBeforeBackground + 2`.
- The `iOS native is bridge proof` project note says ios-native gates Android because both are thin
  JS-bridge wrappers — however `ViewTrackingController` here is a **native Swift** state machine,
  not a JS-bridge passthrough. The iOS view-tracking logic is duplicated from the RN
  `useViewportTracking` hook rather than delegated to core-sdk. Open question for maintainers:
  whether the lifecycle/visibility logic should be consolidated into core-sdk so iOS and RN share
  one implementation, which would make Failure 3's `resume()` semantics consistent by construction.
- The pseudocode contract step 10 wording ("Relaunch the app without resetting state") is genuinely
  ambiguous between _relaunch_ and _background/foreground resume_. This should be clarified in
  `implementations/react-native-sdk/e2e/extended-view-tracking-pseudocode.md` so all SDKs implement
  the same lifecycle transition. Until clarified, the iOS fix in Failure 3 step 5 is provisional.
- Do not weaken the `> 4000` (Failure 1) or `XCTAssertFalse` (Failure 2) assertions — they come
  directly from the pseudocode contract (steps 4 and 6 of their respective sections). All proposed
  fixes preserve the assertions and change only the scroll/lifecycle mechanics.

## Related files

- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingController.swift`
  — `pause()`, `resume()`, `onBecameVisible()`, `onBecameInvisible()`, `scheduleNextFire()`,
  `timerFired()`, `emitEvent()`, `flushAccumulatedTime()`, `updateVisibility()`.
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Tracking/ViewTrackingModifier.swift`
  — `.onGeometryChange` / `onAppear` / `onDisappear` driving `updateVisibility`.
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Handlers/AppStateHandler.swift`
  — `willResignActive` → `flush()`, `didBecomeActive` callbacks.
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizationScrollView.swift`
  — `ScrollOffsetPreferenceKey`, viewport-height preference.
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift` —
  wires `ViewTrackingModifier` with `viewTimeMs` / `viewDurationUpdateIntervalMs`.
- `implementations/ios-sdk/uitests/Tests/ExtendedViewTrackingTests.swift` — the three failing tests.
- `implementations/ios-sdk/uitests/Support/TestHelpers.swift` — `scrollToElement`,
  `waitForComponentEventCount`, `getViewDuration`, `waitForElementText`.
- `implementations/ios-sdk/swiftui/Components/AnalyticsEventDisplay.swift` — renders
  `event-count-<id>`, `event-duration-<id>`, `entry-stats-<id>`.
- `implementations/ios-sdk/shared/EventStore.swift` — `componentStats`, `latestViewDurationMs`,
  in-memory singleton.
- `implementations/ios-sdk/swiftui/Screens/MainScreen.swift` — `OptimizationScrollView` layout,
  entry list, `AnalyticsEventDisplay` placement below all entries.
- `implementations/ios-sdk/shared/Config.swift` — `entryIds` ordering (`VISIBLE_ENTRY_ID` is index
  0, `BELOW_FOLD_ENTRY_ID` is index 6).
- `packages/react-native-sdk/src/hooks/useViewportTracking.ts` — the RN reference implementation
  that passes all three tests (`AppState` `active` branch, `scheduleNextFire`, cycle reset).
- `implementations/react-native-sdk/e2e/extended-view-tracking-pseudocode.md` — the cross-SDK
  contract; numeric assertions and scroll-increment guidance.
