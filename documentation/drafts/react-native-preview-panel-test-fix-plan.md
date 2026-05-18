# React Native `preview-panel-overrides` Detox suite fix plan

## Goal

Get the React Native `preview-panel-overrides.test.js` suite to 4/4 passing on **both**
RN-on-Android and RN-on-iOS in
[`triage-preview-panel-overrides.sh`](../../triage-preview-panel-overrides.sh).

## Current state

| Stack         | Last green outcome                    | Notes                                                        |
| ------------- | ------------------------------------- | ------------------------------------------------------------ |
| rn-on-android | 4/4 PASS (cycles 3+)                  | No outstanding issues.                                       |
| rn-on-ios     | 3/4 PASS, scenario 6 FAIL (cycles 5+) | Scenario 6 times out waiting for the **Reset** alert button. |

The three scenarios that pass on rn-on-ios (2, 3, 4) confirm the JS bridge, preview-panel override
flow, and `OptimizedEntry` resolution work end-to-end on iOS through Detox. Only scenario 6's
specific reset-all confirmation step is broken.

## Failing scenario in detail

[`implementations/react-native-sdk/e2e/preview-panel-overrides.test.js:117-140`](../../implementations/react-native-sdk/e2e/preview-panel-overrides.test.js):

```js
it('scenario 6: reset-all restores variant content', async () => {
  await openPanel()
  // …apply a variant override…
  await element(by.id('reset-all-overrides')).tap()
  // Confirm alert. iOS UIAlertController buttons expose their title via
  // accessibility label, not as plain text; Android's AlertDialog Button
  // exposes the same string as text.
  const resetAlertButton = device.getPlatform() === 'ios' ? by.label('Reset') : by.text('Reset')
  await waitFor(element(resetAlertButton)).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  await element(resetAlertButton).atIndex(0).tap()
  // …
})
```

Failure (cycles 5–7):

```text
TOBEVISIBLE WITH MATCHER(label == "Reset")
```

times out at `ELEMENT_VISIBILITY_TIMEOUT`. Cycle 5 used `by.text('Reset')` and saw
`MATCHER(text == "Reset")` time out the same way. Branching to `by.label` on iOS did not help.

## Root cause

The preview panel renders inside a React Native `Modal`
([`packages/react-native-sdk/src/preview/components/PreviewPanelOverlay.tsx:167`](../../packages/react-native-sdk/src/preview/components/PreviewPanelOverlay.tsx)).
The reset-all action calls
[`Alert.alert(...)`](../../packages/react-native-sdk/src/preview/components/PreviewPanel.tsx:178)
which on iOS surfaces as a `UIAlertController` presented from the modal's host view-controller.

Detox queries iOS UI through `XCUIElement` interrogation rooted at the application. When a
`UIAlertController` is presented from a modal, the alert lives in a separate window hierarchy that
Detox sometimes does not traverse, depending on Detox version and Xcode version. The iOS native
suite has the same scenario but uses `app.alerts.buttons["Reset"]`, which explicitly scopes to the
`XCUIApplication.alerts` hierarchy — Detox has no analogous scoped matcher.

Symptom-wise it's the same failure mode as documented in
[Detox issue #2918](https://github.com/wix/Detox/issues/2918) and similar — buttons inside system
alerts presented over a `Modal` are not findable from the default app root.

## Three options ranked by surgical-ness

### Option 1 — Replace `Alert.alert` with an in-modal confirmation view (recommended)

The destructive-action confirmation is the only thing the iOS `UIAlertController` is used for in the
preview panel. Replace it with a small React Native `Modal` or inline overlay that renders inside
the preview panel's existing modal context.

**Why this is the right answer:**

- Detox can already reach every other element in the preview panel because they all live inside the
  panel's modal context. The reset confirmation should too.
- Keeps the confirmation UI consistent with the rest of the panel's styling rather than rendering an
  OS-styled alert that doesn't match.
- Removes a Detox quirk dependency and the platform-branched matcher.
- This is a small, contained change to one component.

**Where to change:**
[`packages/react-native-sdk/src/preview/components/PreviewPanel.tsx:177-186`](../../packages/react-native-sdk/src/preview/components/PreviewPanel.tsx)
— replace `Alert.alert(...)` with state-driven inline confirmation UI. Add `testID`s for the
confirm/cancel buttons (e.g., `reset-all-confirm` / `reset-all-cancel`) so the test can address them
without label/text fragility.

**Test change required:** update scenario 6 to tap the new `testID` directly. Drop the
platform-branched alert matcher.

### Option 2 — Use Detox `device.matchFinder` / system-dialog API

Detox has `device.appLaunchedWithRecentNotificationsForBundle` and some platform-specific hooks but
no first-class API for tapping into `UIAlertController` buttons that are presented from a modal.
Investigation candidates:

- `waitFor(element(by.label('Reset')).atIndex(N))` with different indices — sometimes the alert is
  reachable but at a non-zero index because of stale matches.
- `device.takeScreenshot()` to confirm the alert is actually appearing on screen vs. not being
  presented at all.
- Detox's `--take-screenshots failing` flag (already mentioned in the triage doc's known-follow-ups
  section).
- Upgrading Detox if the running version predates a known fix for modal-presented alerts.

**Why this is the harder answer:** even when these work, they tend to be flaky across Detox versions
and iOS minor versions. The fix becomes "works on my machine" until the next Xcode upgrade.

### Option 3 — Skip scenario 6 on rn-on-ios

Add a platform guard:

```js
;(device.getPlatform() === 'ios' ? it.skip : it)(
  'scenario 6: reset-all restores variant content', ...)
```

Document the skip in the test file with a link to this plan. Use only if Options 1 and 2 are both
blocked and the scenario isn't shipping-critical for RN-on-iOS specifically.

Note that the same scenario passes on RN-on-Android and on iOS-native, so the SDK behavior is
covered — only the RN-on-iOS Detox-vs-`UIAlertController` interaction is missing.

## Recommended sequence

1. **Implement Option 1.** Replace `Alert.alert` in `PreviewPanel.tsx` with an inline confirmation
   modal. Add `reset-all-confirm` / `reset-all-cancel` testIDs.
2. **Update scenario 6** in `e2e/preview-panel-overrides.test.js` to tap
   `by.id('reset-all-confirm')`. Drop the `device.getPlatform()` branch.
3. **Rebuild the package and reinstall into RN implementation:**
   ```sh
   pnpm build:pkgs
   pnpm implementation:run -- react-native-sdk implementation:install
   ```
4. **Validate both RN stacks:**
   ```sh
   STACKS='rn-on-android rn-on-ios' ./triage-preview-panel-overrides.sh
   ```
   Both should be 4/4 PASS.
5. **Confirm no regression** in other RN tests that exercise the reset-all flow (search under
   `implementations/react-native-sdk/e2e` for any other use of `reset-all-overrides`).

## Cross-platform consistency

The iOS-native suite uses `app.alerts.buttons["Reset"]` to handle a native `UIAlertController`
directly. The Android-native suite uses `By.text("Reset")` to handle the native `AlertDialog`. Both
native suites are fine because they query the OS accessibility tree directly, not the RN bridge.

If Option 1 (inline confirmation modal) lands, the **RN** preview panel will diverge from the
**native** preview panels in how it confirms destructive actions. The native SDK preview panels can
either:

- Keep using their OS-native alerts (already working in tests), or
- Be migrated to a similar inline confirmation pattern for visual consistency across platforms.

This is a design-system question, not a test question. Recommend deferring the cross- platform
unification to a separate cleanup task after the test suites are all green.

## What this fix does _not_ address

- **Cross-platform fixture-id parity** — RN currently asserts the nested `5i4S → 5a8O` swap, iOS
  asserts the top-level `1JAU → 2KIW` swap. See
  [ios-preview-panel-test-fix-report.md](./ios-preview-panel-test-fix-report.md) for the divergence
  rationale and [android-preview-panel-test-fix-plan.md](./android-preview-panel-test-fix-plan.md)
  for the related Android decision.
- **Hardened (A)+(B)+(C) assertion pattern** — the
  [triage doc](../../triage-preview-panel-overrides.md) describes a stronger assertion pattern that
  is not yet applied to any platform. Follow-up after all three suites are green.
- **Bug A (anonymous-personalizations lock race)** — RN does not currently hit Bug A in the
  scenarios because of the `device.launchApp({ newInstance: true, delete: true })` +
  `terminateApp` + `launchApp({ newInstance: true })` startup pattern, which cold-starts the SDK
  with an identified-state cache hydrated from `AsyncStorage`. The race exists in the universal RN
  SDK but is masked by the RN test harness shape.
