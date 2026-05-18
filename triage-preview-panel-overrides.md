# PreviewPanelOverridesTests cross-platform triage

**Status:** seven triage cycles complete. Cycle 1 had infra blockers on three of four stacks; cycles
2-6 cleared the blockers and produced substantive cross-platform data; cycle 7 tested the
terminate+relaunch hypothesis on natives and showed it does not transfer. **Scope:** describe what
each platform's PreviewPanelOverridesTests suite actually verifies, identify what it does _not_
verify, and propose a single hardened assertion pattern for the follow-up fix step. Out of scope:
writing the fix.

## ⏵ iOS-native handover (start here)

**The current focus is iOS native.** Reason from the user:

> iOS native passing proves the JS <> iOS native bridge works properly. If this doesn't work on iOS
> it will certainly not work on Android.

The Swift SDK at `packages/ios/ContentfulOptimization/` runs the optimization JS core inside a
**JavaScriptCore** context. The Swift layer is intentionally thin — see `packages/ios/CODE_MAP.md`
and the `ios-jsc-bridge/` TypeScript adapter. So the iOS-native suite is effectively an end-to-end
test of the JS↔Swift bridge surface.

### The failing assertion

`implementations/ios-sdk/uitests/Tests/PreviewPanelOverridesTests.swift` line 33:

```swift
XCTAssertTrue(variantEntry.waitForExistence(timeout: ELEMENT_VISIBILITY_TIMEOUT),
              "Expected variant entry to render after identify")
```

This precondition lives in `identifyAndWaitForEntries()` and runs in `setUp()`. Four scenarios all
fail at this same point: the variant entry (`entry-text-5a8ONfBdanJtlJ39WWnH1w`) never appears
within `ELEMENT_VISIBILITY_TIMEOUT = 10s` after the user is identified.

### Fixture IDs (all platforms share these)

```
AUDIENCE_ID       = 4yIqY7AWtzeehCZxtQSDB
EXPERIENCE_ID     = 7DyidZaPB7Jr1gWKjoogg0
BASELINE_ENTRY_ID = 5i4SdJXw9oDEY0vgO7CwF4   # what unidentified / baseline renders
VARIANT_ENTRY_ID  = 5a8ONfBdanJtlJ39WWnH1w   # what identified-user renders by default
```

### What's been tried (don't repeat without a new reason)

- **Cycle 4** (the current pre-cycle-7 setup): tap identify → wait reset-button → assert
  `entry-text-VARIANT` visible within 10s. **4/4 FAIL.**
- **Cycle 7** (reverted): added `app.terminate(); app.launch()` between the reset-button wait and
  the variant assertion (mirroring RN's working `device.terminateApp()` +
  `device.launchApp({newInstance: true})`). **Still 4/4 FAIL** with the same message. Reverted
  because it changed nothing. RN's pattern does not transfer. Likely reason it didn't transfer: RN
  persists identify state via AsyncStorage so cold-launch rehydrates the visitor. iOS likely keeps
  identify in the JSContext (in-memory) only — cold launch loses it. Verify by reading the
  JSContextManager lifecycle and any StorageDefaults usage in
  `packages/ios/ContentfulOptimization/Sources/`.

### Hypotheses worth testing next (ranked)

1. **The iOS variant render is just slow.** Bump `ELEMENT_VISIBILITY_TIMEOUT` for this one assertion
   to `EXTENDED_TIMEOUT` (30s, already defined in
   `implementations/ios-sdk/uitests/Support/TestHelpers.swift:4`) and see if the assertion
   eventually passes. Cheapest hypothesis to falsify.
2. **The JS bridge takes time to deliver the identify-resolved state to Swift's `@Published`
   properties.** Look for a `Combine`/`@Published` variant entry sink in
   `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/` (likely
   `OptimizationClient`). The bridge may emit the resolved entry list asynchronously after identify
   — the test should `await` that signal, not just wait on UI rendering. Compare to how
   `reset-button` becomes visible (that one _does_ work) to see what the SDK already awaits cleanly.
3. **Identify isn't reaching the JS core.** Add a logging side-channel inside `JSContextManager` (or
   whatever the bridge entry point is) to confirm `identify(...)` actually gets dispatched into JS.
   Mock server logs (`triage-out/<latest>/ios-native.mock.log` if captured) can also show whether
   the identify network call hits localhost:8000.
4. **Race in the JS core's experience resolution after identify.** Same shape as Bug A on Android —
   if so, the fix is the same shape: ensure the resolved-entries stream is settled before the SDK
   publishes it to Swift.

### How to run just this stack

```sh
STACKS=ios-native ./triage-preview-panel-overrides.sh
```

Outputs land in `triage-out/<timestamp>/ios-native.test.log` and
`triage-out/<timestamp>/ios-native.device.log` (xcresult JSON). The iOS build is now cached; expect
~2-3 minutes per iteration when the sim is already warm.

### Constraints worth respecting

- Memory: `feedback_push_logic_to_js.md` — iOS SDK should stay thin, push logic into JS/core-sdk.
  Fixes that add Swift business logic fight that direction.
- Memory: `feedback_no_hack_fixes.md` — fix root cause, don't bypass the system under test. So if
  the bug is "iOS bridge doesn't surface identified state in time", don't just extend the timeout
  indefinitely; understand _why_ it isn't surfaced.
- The triage script and the RN test code have been patched substantially in cycles 2-6; do not
  revert those (see
  [What changed in the orchestrator and the RN test suite](#what-changed-in-the-orchestrator-and-the-rn-test-suite)).
- The native iOS and Android `PreviewPanelOverridesTests` files are back on their cycle-4 state
  (cycle-7 edits reverted).

## Background

Earlier work on Android (`documentation/drafts/android-variant-resolution-bug-report.md`) hardened
`PreviewPanelOverridesTests.kt` from a fuzzy substring assertion
(`assertEntryContentContains("baseline" | "variant")`) to a resolved-id assertion
(`assertEntryVisible(<exact-entry-id>)`). The hardening surfaced two distinct Android bugs:

- **Bug A:** `OptimizedEntry`'s `LaunchedEffect`-based lock races with the state stream and latches
  onto a transient anonymous personalizations list.
- **Bug B:** the resolver returns baseline for nested `5i4Sd` even with the correct
  personalizations, because `5i4Sd.fields.nt_experiences` lists only the parent experience `1FHhEY`,
  not its own `7Dyid`.

That investigation raised a question we could not answer in-flow: **are iOS and React Native passing
because the SDK actually works on those platforms, or because their assertions are similarly
permissive and missing the same failure mode silently?**

This document captures the data needed to decide.

## Reading guide

- For test results, see `triage-out/<timestamp>/summary.md`.
- For raw per-stack test runner output, see `triage-out/<timestamp>/<stack>.test.log`.
- For device logs (logcat / xcresult), see `triage-out/<timestamp>/<stack>.device.log`.

## Asymmetries across the three suites

The three suites share fixture data, scenario names, and entry IDs:

```
AUDIENCE_ID        = 4yIqY7AWtzeehCZxtQSDB
EXPERIENCE_ID      = 7DyidZaPB7Jr1gWKjoogg0
BASELINE_ENTRY_ID  = 5i4SdJXw9oDEY0vgO7CwF4   # what the baseline chain renders
VARIANT_ENTRY_ID   = 5a8ONfBdanJtlJ39WWnH1w   # what the variant chain renders after identify
```

But they differ in three places that materially change what they actually verify.

### 1. setUp shape

| Platform | setUp does                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS      | Launch app → clearProfileState → tap identify → wait for reset-button → assert entry-text-VARIANT visible                                                                                       |
| Android  | Launch app → clearProfileState → tap identify → wait for reset-button → assertEntryVisible(VARIANT)                                                                                             |
| RN       | `launchApp({newInstance: true, delete: true})` → clearProfileState → tap identify → wait for reset-button → `**terminateApp` → `launchApp({newInstance: true})**` → wait for entry-text-VARIANT |

The RN suite is the only one that **uninstalls and reinstalls** the app between scenarios
(`delete: true`) and the only one that **relaunches** after identify before asserting variant
content. Both are non-trivial state-cleanup signals. They mean two things for the triage:

- RN starts from a colder cache than iOS or Android, which avoids the "cached identified state +
  clearProfileState wipe + identify" oscillation documented in Bug A. So RN may pass even if the
  underlying SDK behavior has the same race iOS/Android hit.
- RN's terminate+relaunch after identify forces a fresh entry fetch with the post-identify profile
  already cached. Again, no oscillation to race with.

This is **not** the smoking gun for the cross-platform diff. It is one ordering-related signal among
several. Several other factors below could also explain divergent behavior.

### 2. Assertion strength

All three suites assert _presence_ of the target entry id. None assert _absence_ of the previous
state's entry id, and none scope the assertion to the wrapper container that should have been
substituted.

| Platform | Assertion API                                                                    | Visibility semantics                                  |
| -------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| iOS      | `findElement("entry-text-X").waitForExistence(timeout:)`                         | Tree-existence; not strictly visible                  |
| Android  | `UiScrollable.scrollIntoView(...)` + `device.findObject(By.res("entry-text-X"))` | Visible (UI Automator findObject filters to visible)  |
| RN       | `waitFor(element(by.id("entry-text-X"))).toExist().withTimeout(...)`             | Tree-existence; `toExist` does not require visibility |

Concrete failure mode this misses for all three: imagine the variant entry renders **alongside** the
baseline (rather than replacing it in the same nested slot). The current assertions all pass — the
target id is in the tree — even though the override did not actually substitute the right slot.

### 3. Audience expansion in scenarios 4 & 6

These two scenarios need to tap `variant-picker-<EXPERIENCE_ID>-0`. That picker only mounts when the
parent audience is expanded.

| Platform | How                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS      | Does not expand. Directly looks up `variant-picker-<EXPERIENCE_ID>-0` and taps it. Implies iOS panel renders pickers regardless of expanded state, OR XCTest sees them through accessibility even when collapsed.                               |
| Android  | `expandTargetAudienceAndTapVariant()` — scroll to `audience-expand-<AUDIENCE_ID>` desc, single-click it, then scroll the panel to the variant picker. The audience-expand handling is the area of recent churn (5+ commits before this triage). |
| RN       | Taps the audience header text label literally `'Identified Users'` (the audience's display name), then scrolls to the picker.                                                                                                                   |

This means the three suites are exercising **different code paths through the panel UI** even though
they intend to test the same SDK behavior. A fix that closes a path on one platform may have no
effect on the other two.

## Recommended hardened assertion pattern (for the fix step)

Adopt the same pattern on all three suites so cross-platform regressions are visible by direct
comparison of pass/fail. The pattern has three components per scenario:

### zA. Pre-test anti-leak guard

Before any panel interaction, assert that the _expected post-action_ entry id is **NOT** in the
tree. This catches state-bleed between scenarios and guarantees the post-action assertion is
detecting a real transition, not stale state from a prior test.

```kt
// Android, before openPanel()
assertEntryNotVisible(BASELINE_ENTRY_ID,
    "Pre-test guard: baseline should not be visible before scenario 2 runs")
```

```swift
// iOS, before openPanel()
let baseline = app.find(id: "entry-text-\(BASELINE_ENTRY_ID)")
XCTAssertFalse(baseline.exists,
    "Pre-test guard: baseline should not be visible before scenario 2 runs")
```

```js
// RN, before openPanel()
await expect(element(by.id(`entry-text-${BASELINE_ENTRY_ID}`))).not.toExist()
```

### B. Post-action: previous-state id disappears

After applying the override, assert the **previous state's** entry id is gone from the tree. This is
the half of the proof that current assertions miss — without it, a passing test cannot distinguish
"override replaced the slot" from "override did nothing, but the result entry appeared somewhere
else."

### C. Post-action: target id is present, scoped to the wrapper

The entry wrapper desc (`content-entry-<requested-id>`) does not change with resolution. The inner
`entry-text-<resolved-id>` does. Asserting that the target `entry-text-`\* appears **inside the
corresponding wrapper's visible bounds** confirms the override replaced the correct slot rather than
just appearing somewhere else on screen. Android's existing `getEntryContentText` helper already
does parent-bounds scoping for this reason; we want the equivalent on iOS and RN.

### Why this matters

(A) + (B) + (C) together prove substitution. Any one alone admits a false-positive. The current
suites have only (C), and even that without the wrapper-scope check.

## How to use the triage script as the fix-iteration loop

`./triage-preview-panel-overrides.sh` is the iteration loop for the next step. It:

- Runs each platform's `PreviewPanelOverridesTests` in sequence using each implementation's existing
  run scripts.
- Captures test runner stdout/stderr, device logs (logcat / xcresult), and exit codes into a
  timestamped folder under `triage-out/`.
- Tears down the emulator, simulator, mock server, and Gradle daemons between stacks so the host
  machine does not run out of memory.

### Typical iteration cycle

1. Make a change to one of:

- the test code in
  `implementations/{android-sdk,ios-sdk,react-native-sdk}/.../PreviewPanelOverridesTests.`\*,
- the SDK in `packages/{android,ios,universal}/...`,
- or the mock fixture in `lib/mocks/src/...`.

2. Run a focused stack:

```sh
 STACKS=android-native ./triage-preview-panel-overrides.sh
```

3. Read `triage-out/<timestamp>/summary.md` for the PASS/FAIL signal and
   `triage-out/<timestamp>/<stack>.test.log` for the failure context.
4. Once one platform looks right, run the other three to check parity:

```sh
 STACKS='ios-native rn-on-android rn-on-ios' ./triage-preview-panel-overrides.sh
```

### Env overrides

| Variable          | Purpose                               | Default                                             |
| ----------------- | ------------------------------------- | --------------------------------------------------- |
| `STACKS`          | Subset of stacks to run               | `android-native ios-native rn-on-android rn-on-ios` |
| `IOS_SIM_NAME`    | iOS sim name for the native iOS run   | `iPhone 16e`                                        |
| `IOS_SIM_OS`      | iOS sim runtime                       | `latest`                                            |
| `DETOX_AVD_NAME`  | AVD Detox picks for android.emu.\*    | `pixel_7_api35_e2e`                                 |
| `ANDROID_EMU_AVD` | AVD the android-native runner pins to | `pixel_7_api35_e2e`                                 |

### Resource-cleanup behavior

Before and after each stack the orchestrator:

- Kills any `qemu-system` (Android emulator) process, gracefully via `adb emu kill` first, then
  `SIGKILL` if it does not exit within 8 seconds.
- Shuts down all booted iOS simulators with `xcrun simctl shutdown all`.
- Stops Gradle daemons for both Android projects (`./gradlew --stop`).
- Kills any process bound to `localhost:8000` (the mock server).

If you need to debug a single stack without all the teardown noise, invoke the platform's run script
directly — the orchestrator only adds cleanup and log capture.

## Triage iterations — observed results

Six cycles total. Cycle 1 hit infra blockers on three of four stacks. The remaining cycles cleared
each blocker in turn and converged on substantive test data. Each cycle's raw output lives under
`triage-out/<timestamp>/`. The exact timestamps are listed inline below for cross-referencing.

### Cycle 1 — `triage-out/20260515-112201/` (baseline, no patches)

| Stack          | Outcome                       | Failure class                                                                                                                                                                                                         |
| -------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| android-native | 4/4 FAIL                      | **Substantive.** Reproduces Bug A + Bug B from `documentation/drafts/android-variant-resolution-bug-report.md`. The hardened `assertEntryVisible(<resolved-id>)` setUp does its job.                                  |
| ios-native     | BLOCKED                       | `xcodebuild build-for-testing` aborts because iOS 26.5 sim runtime is not installed. Never reached the test phase.                                                                                                    |
| rn-on-android  | 4/4 FAIL by handshake timeout | **Infra.** App launches but never reports ready over Detox's WebSocket. Root cause (found in cycle 2): triage script did not start Metro on 8081, so the debug build hung waiting for a JS bundle that never arrived. |
| rn-on-ios      | BLOCKED                       | iOS 26.5 sim runtime missing + `Detox.framework could not be found` for the current Xcode hash.                                                                                                                       |

### Cycle 2 — `triage-out/20260515-153253/`

Same baseline; iOS 26.5 simulator install finished mid-run, so ios-native results moved from
"BLOCKED before build" to "build succeeded, test phase tripped on stale xcresult".

| Stack          | Outcome                                | Failure class                                                                                                                                                           |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| android-native | 4/4 FAIL                               | Same Bug A + Bug B (re-confirmed).                                                                                                                                      |
| ios-native     | exit=64                                | **Infra.** Build succeeded with iOS 26.5. `xcodebuild test-without-building` refused to write `Test-SwiftUI.xcresult` because the prior failed run had left one behind. |
| rn-on-android  | 4/4 FAIL same handshake timeout        | Same Metro-missing failure — script changes weren't picked up by the already-running invocation.                                                                        |
| rn-on-ios      | 0/4 ran, suite-level DetoxRuntimeError | **Infra.** `Detox.framework could not be found` at the Xcode-26.5 hash. Build itself succeeded with the iOS 26.5 SDK.                                                   |

### Cycle 3 — `triage-out/20260515-154907/`

First run after patching `run_rn_on_android` to start Metro on 8081 (Detox `reversePorts: [8081]` in
`.detoxrc.js` handles the `adb reverse` itself), and adding `pnpm exec detox build-framework-cache`
to `run_rn_on_ios`.

| Stack         | Outcome                                                                                    | Failure class                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ios-native    | exit=64                                                                                    | Same stale xcresult collision as cycle 2 (patch landed but not in this run).                                                                    |
| rn-on-android | **4/4 PASS** in 131s                                                                       | **Substantive.** Metro patch unblocked the Detox handshake. The existing permissive assertion (`expect(by.id(entry-text-X)).toExist()`) passes. |
| rn-on-ios     | suite-level DetoxRuntimeError: `Failed to find a device by type = "iPad Pro 13-inch (M4)"` | **Infra.** Apple replaced the iPad Pro line M4 → M5 in iOS 26.5. The hardcoded `device.type` in `.detoxrc.js` no longer resolves.               |

### Cycle 4 — `triage-out/20260515-171512/`

Patches: xcresult cleanup in `run_ios_native`; `.detoxrc.js` made `device.type` env-overridable
(`DETOX_IOS_DEVICE`, default unchanged); default `IOS_SIM_NAME` raised from `iPhone 16e` (removed in
26.5) to `iPhone 17`; `DETOX_IOS_DEVICE=iPhone 17` set in the orchestrator.

| Stack         | Outcome             | Failure class                                                                                                                                                                                                                                                                                                |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ios-native    | **4/4 FAIL** in 77s | **Substantive.** `XCTAssertTrue failed - Expected variant entry to render after identify` on every scenario. That is the same setUp precondition that already existed in the iOS suite — Bug A reproduces identically.                                                                                       |
| rn-on-android | 4/4 PASS            | Confirms cycle 3 result. No regression from the patches.                                                                                                                                                                                                                                                     |
| rn-on-ios     | 0/4 ran — test bug  | **Test code bug.** `scrollPanelToId` used `by.type('android.widget.ScrollView')`, which has no analogue on iOS. Detox returned `Unknown class "android.widget.ScrollView"` for every scenario. RN-on-iOS had never actually exercised the SDK before this cycle — the prior infra blockers were hiding this. |

### Cycle 5 — `triage-out/20260515-174253/`

Patches: added `testID="preview-panel-scroll"` to the panel `ScrollView` in
`packages/react-native-sdk/src/preview/components/PreviewPanel.tsx`, rebuilt package tarballs
(`pnpm build:pkgs`), reinstalled the RN implementation, and switched the test's
`whileElement(by.type(...))` to `whileElement(by.id('preview-panel-scroll'))`. Platform-class
branching removed.

| Stack         | Outcome                           | Failure class                                                                                                                                                                                                                                |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rn-on-android | 4/4 PASS                          | No regression from the SDK change.                                                                                                                                                                                                           |
| rn-on-ios     | **3/4 PASS, 1 FAIL** (scenario 6) | **Substantive.** Scenarios 2, 3, 4 actually run through the SDK now. Scenario 6 times out waiting for the alert: `TOBEVISIBLE WITH MATCHER(text == "Reset")`. RN's `Alert.alert` button is reachable by `by.text` on Android but not on iOS. |

### Cycle 6 — `triage-out/20260515-175226/`

Patch: scenario 6's alert matcher branched per platform — `by.label('Reset')` on iOS,
`by.text('Reset')` on Android. Re-ran rn-on-ios only.

| Stack     | Outcome          | Failure class                                                                                                                                                                                                                               |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rn-on-ios | 3/4 PASS, 1 FAIL | Still timing out, now on `MATCHER(label == "Reset")`. The Alert is either not appearing or not exposed to UI automation through the `Modal` that hosts the preview panel. **Detox/UIAlertController matcher quirk; not an SDK regression.** |

### Cycle 7 — `triage-out/20260515-183907/` (terminate+relaunch hypothesis, reverted)

Hypothesis: if RN passes because of its `terminateApp` + `launchApp({newInstance: true})` pattern
between identify and the variant-entry assertion, applying the same pattern to the native suites
should sidestep Bug A. Patches added: `app.terminate()` + `app.launch()` in iOS
`identifyAndWaitForEntries`, and `device.executeShellCommand("am force-stop $pkg")` +
`AppLauncher.launchApp(device)` in Android `identifyAndWaitForVariant`.

| Stack          | Outcome                              | What we learned                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| android-native | Process CRASHED (no scenario ran)    | The `:uitests` instrumentation has `targetPackage="com.contentful.optimization.app"`, so the AndroidJUnit runner attaches to the app's process. `am force-stop` on the target package kills the runner too. **Android cannot do an in-test terminate-and-relaunch with this manifest layout.**                                                                                  |
| ios-native     | 4/4 FAIL same precondition           | `app.terminate()` + `app.launch()` ran without error, but the variant entry still does not render within `ELEMENT_VISIBILITY_TIMEOUT` after the cold relaunch. **iOS native does not behave like RN-on-iOS after the same terminate+relaunch shape.** Implication: the iOS native and RN persistence/identify-rehydration paths differ; the RN pass on iOS does not generalise. |
| rn-on-android  | 4/4 PASS                             | No regression. Cycle 7 was a no-op for RN.                                                                                                                                                                                                                                                                                                                                      |
| rn-on-ios      | 3/4 PASS, 1 FAIL on scenario 6 alert | No regression.                                                                                                                                                                                                                                                                                                                                                                  |

Both native edits were reverted at the end of cycle 7. The native suites are back on their
pre-cycle-7 setUp.

**Implication for "get all tests to pass" goal:** test-only changes cannot make the native suites
pass. Bug A is in the SDK, not in the test harness, and the iOS and Android SDK
persistence/state-stream paths differ from RN's enough that the RN pattern does not transfer. An
SDK-level fix is required before the (A)+(B)+(C) hardening step.

## What the iterations answered

The two open questions about Bug A from the iOS/RN suites have now been answered.

**Q1: Does iOS pass its `entry-text-VARIANT` setUp precondition?** No. Cycle 4 produced
`XCTAssertTrue failed - Expected variant entry to render after identify` on all four scenarios. The
native iOS suite's existing setUp assertion is already strong enough to catch the same race that Bug
A documents for Android; we just never got past the iOS 26.5 infra blocker to actually run it. **Bug
A is cross-platform.**

**Q2: Does RN pass?** Yes for RN-on-Android (cycles 3-5: 4/4 PASS) and yes for the three non-alert
scenarios on RN-on-iOS (cycle 5+: 2, 3, 4 PASS). The RN suite's
`launchApp({ newInstance: true, delete: true })` → `clearProfileState` → `identify` → `terminateApp`
→ `launchApp({ newInstance: true })` startup pattern starts from a cold cache and avoids the
LaunchedEffect/state-stream race that
`documentation/drafts/android-variant-resolution-bug-report.md` documents. So:

- The SDK behavior under "freshly-launched-with-identified-cache" is correct on both Android and
  iOS.
- The race-shaped Bug A failure is **specific to the warm-cache oscillation** the native suites
  exercise (cached identified state → clearProfileState wipe → identify) and is **present on both
  native platforms**.

The third open question — _do passing platforms still pass with the hardened (A)+(B)+(C) pattern?_ —
has not been answered yet, because it requires a follow-up step to actually write (A)+(B)+(C) on iOS
and RN. That remains future work; the substantive infra to do it is now in place.

## What changed in the orchestrator and the RN test suite

These edits landed during the iteration and stay in place:

- `triage-preview-panel-overrides.sh`
  - Starts Metro on 8081 for both RN stages (Detox's `reversePorts` handles `adb reverse`
    automatically; Metro itself was missing).
  - Calls `detox build-framework-cache` in `run_rn_on_ios` (idempotent; no-op when the cache for the
    current Xcode + Detox version already exists).
  - Deletes `/tmp/optimization-ios-derived-data/Test-{SwiftUI,UIKit}.xcresult` before each
    `xcodebuild test-without-building` so a prior failed run doesn't block the next one.
  - Default `IOS_SIM_NAME` is now `iPhone 17` (was `iPhone 16e`, removed on iOS 26.5).
  - Exports `DETOX_IOS_DEVICE=iPhone 17` for the RN-on-iOS stage.
- `implementations/react-native-sdk/.detoxrc.js`
  - `devices.simulator.device.type` now reads
    `process.env.DETOX_IOS_DEVICE || 'iPad Pro 13-inch (M4)'`. Default is unchanged so CI stays
    green; local Xcode 26.5 environments can override via the env var.
- `packages/react-native-sdk/src/preview/components/PreviewPanel.tsx`
  - Adds `testID="preview-panel-scroll"` to the panel's `ScrollView`.
- `implementations/react-native-sdk/e2e/preview-panel-overrides.test.js`
  - `scrollPanelToId` uses `whileElement(by.id('preview-panel-scroll'))` instead of
    `whileElement(by.type('android.widget.ScrollView'))`. This works cross-platform without
    per-platform class names.
  - Scenario 6's alert assertion branches per platform: `by.label('Reset')` on iOS,
    `by.text('Reset')` on Android.

## Known follow-ups

- RN-on-iOS scenario 6 still fails at the Reset alert button. Neither `by.text` nor `by.label` finds
  it. Likely causes to investigate:
  - The preview panel renders inside a `Modal`
    (`packages/react-native-sdk/src/preview/components/PreviewPanelOverlay.tsx:167`); the iOS
    `UIAlertController` is presented over the modal, and Detox's query may be scoped to the modal's
    view-controller subtree.
  - Detox is not capturing screenshots by default; enable `--take-screenshots failing` and inspect
    the artifact to confirm the alert actually appears.
  - The native iOS suite uses `app.alerts.buttons["Reset"]`, which explicitly scopes to the alert;
    Detox has no direct equivalent.
- The (A)+(B)+(C) hardened assertion pattern from
  [Recommended hardened assertion pattern](#recommended-hardened-assertion-pattern-for-the-fix-step)
  has not been applied to the iOS or RN suites yet. Cross-platform parity in assertion _strength_ is
  the next step.
- The orchestrator still does a post-mortem `adb logcat -d` rather than a streamed `logcat -T 1`.
  Early-launch logs may roll off the ring buffer in long stages. Worth changing if we need
  RN-on-Android startup logs in a future iteration.
