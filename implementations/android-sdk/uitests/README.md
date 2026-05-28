# UI Automator E2E tests

> [!NOTE] Internal — this README orients maintainers of the Android E2E suite. Reader-facing
> integration guidance for the Android SDK lives in
> [`packages/android/README.md`](../../../packages/android/README.md).

## Scope

These tests drive the Android reference implementation through `androidx.test.uiautomator` to verify
that real UI interactions surface the right behavior across the SDK and demo app. They run inside an
Android Studio Emulator AVD on CI via
[`.github/workflows/main-pipeline.yaml`](../../../.github/workflows/main-pipeline.yaml) and locally
via [`scripts/run-e2e.sh`](../scripts/run-e2e.sh).

This is the wrong layer for assertions about SDK-internal state machines. Anything that needs to
verify timing, threshold math, or coroutine sequencing should be a JVM unit test under
[`packages/android/ContentfulOptimization/src/test/`](../../../packages/android/ContentfulOptimization/src/test/),
not here.

## Deleted view-tracking tests

The following `@Test` methods were deleted in
[`1be50e49`](https://github.com/contentful/optimization/commit/1be50e49) because they conflated the
`ViewTrackingController` dwell state machine with real UI scroll timing and were intolerant of the
x86_64 CI emulator. The SDK contract they nominally verified now lives in
[`ViewTrackingControllerTest`](../../../packages/android/ContentfulOptimization/src/test/kotlin/com/contentful/optimization/tracking/ViewTrackingControllerTest.kt):

| Former E2E test                                                         | Where the contract lives now                                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnalyticsTests.testTracksEntryViewEventsForVisibleEntries`             | `ViewTrackingControllerTest` — the BECAME_VISIBLE → dwell → emit path                                                                                                 |
| `FlagViewTrackingTests.testEmitsFlagViewEventsForSubscribedBooleanFlag` | `ViewTrackingControllerTest` — same dwell path; flag subscription wiring is exercised by the JS bridge tests                                                          |
| `OfflineBehaviorTests.testContinuesToTrackEventsWhileOffline`           | `ViewTrackingControllerTest` covers the dwell-fired event; `testRecoverGracefullyWhenNetworkRestored` (kept) covers the offline-to-online identify path without dwell |
| `OfflineBehaviorTests.testQueueEventsOfflineAndFlushWhenOnline`         | Same as above                                                                                                                                                         |

All four asserted on the per-entry `component-stats-<id>` (or `events-count >= N`) UI elements,
which required the SDK to emit a tracker event, which in turn required a real swipe to settle into
the 0.8 visibility threshold and stay there for 2 s. On the CI emulator the swipe routinely clipped
the visible-ratio back below threshold mid-dwell, `onBecameInvisible` reset the cycle with
`attempts=0`, and the stats element never appeared. The SDK was enforcing the documented contract
correctly — the harness was racing it. See
[`ANDROID_VIEW_TRACKING_TESTS.md`](../../../ANDROID_VIEW_TRACKING_TESTS.md) for the full incident
write-up.

## What still belongs here

E2E tests are the right layer when the thing under test is **the wiring between the SDK and the demo
app**:

- preview panel overrides flowing into rendered entries
  ([`PreviewPanelOverridesTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/PreviewPanelOverridesTests.kt))
- identify and reset round-trips changing what the demo app renders
  ([`IdentifiedVariantsTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/IdentifiedVariantsTests.kt),
  [`UnidentifiedVariantsTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/UnidentifiedVariantsTests.kt))
- network state changes affecting identify behavior
  ([`OfflineBehaviorTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/OfflineBehaviorTests.kt))
- screen tracking and tap tracking firing on real navigation and clicks
  ([`ScreenTrackingTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/ScreenTrackingTests.kt),
  [`TapTrackingTests`](src/main/kotlin/com/contentful/optimization/uitests/tests/TapTrackingTests.kt))

If a test would assert on the dwell timer, the visibility ratio threshold, or the multi-attempt
cadence, add it to `ViewTrackingControllerTest` instead.

## Running the tests

Locally against a running emulator or device:

```sh
# from implementations/android-sdk
APP_PACKAGE=com.contentful.optimization.app ./scripts/run-e2e.sh
```

To target the XML Views demo variant:

```sh
APP_PACKAGE=com.contentful.optimization.app.views ./scripts/run-e2e.sh
```

The unit tests that own the dwell contract:

```sh
# from implementations/android-sdk
./gradlew :ContentfulOptimization:testDebugUnitTest
```
