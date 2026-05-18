# Android `PreviewPanelOverridesTests` fix plan

## Goal

Get the Android-native `PreviewPanelOverridesTests` suite to 4/4 passing in
[`triage-preview-panel-overrides.sh`](../../triage-preview-panel-overrides.sh) without weakening the
existing assertion shape (resolved-entry-id, not fuzzy substring).

## Current state

| Run                                                                   | Outcome         | Note                                                                                                           |
| --------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| Cycle 1 baseline ([`triage-out/20260515-112201/`](../../triage-out/)) | 4/4 FAIL        | All four scenarios fail at `setUp`'s `assertEntryVisible(VARIANT_ENTRY_ID, …)` precondition. Reproduces Bug A. |
| Cycle 7 ([`triage-out/20260515-183907/`](../../triage-out/))          | Process crashed | `am force-stop` in-test killed the AndroidJUnit runner. Not a fix path.                                        |
| Today (after iOS work)                                                | Unchanged       | Android sources were not touched by the iOS triage; behavior is identical to cycle 1.                          |

The failure mode is documented in
[`android-variant-resolution-bug-report.md`](./android-variant-resolution-bug-report.md):
`OptimizedEntry` locks onto the transient anonymous personalizations emitted before `identify()`
resolves, so the resolved entry stays at baseline and `entry-text-5a8ONfBdanJtlJ39WWnH1w` never
enters the accessibility tree.

`Bug B` from that same report is **no longer active**. Direct inspection of
`lib/mocks/src/contentful/data/space/ctfl-space-data.json` shows
`5i4SdJXw9oDEY0vgO7CwF4.fields.nt_experiences = [{ id: "7DyidZaPB7Jr1gWKjoogg0" }]`, and
`__bridge.getPreviewState()` correctly returns the `5i4S → 5a8O` mapping in the `7Dyid` experience's
`variants` map. The fixture has been updated since the report was written. The Android failure is
purely Bug A.

## What the iOS fix did, and why it doesn't transfer

The iOS suite worked around Bug A without an SDK fix by:

1. Relaxing `setUp` to only assert that the baseline wrapper exists (not that any specific resolved
   variant is rendered).
2. Letting each scenario rely on the OptimizedEntry panel-close re-snapshot
   (`onReceive(client.$isPreviewPanelOpen)`) to capture the post-action state.

This works on iOS because the SwiftUI `OptimizedEntry` has a `onReceive(client.$isPreviewPanelOpen)`
block that re-snapshots `lockedPersonalizations` when the panel closes. The Compose `OptimizedEntry`
at
`packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt:55-65`
has the equivalent `LaunchedEffect(isPreviewPanelOpen)` block, so the workaround _should_ transfer
in principle.

However, the iOS workaround also depends on the test using a baseline-wrapper id
(`content-entry-<BASELINE>`) that exists regardless of resolution outcome. Android's
`assertEntryVisible(entryId)` helper looks for `entry-text-<resolved-id>`, which only appears if the
resolver returned the expected resolved entry id. The Android wrapper has its own testTag
(`content-entry-<baseline>`) that is always present, so the same relaxation pattern is available.

## Two paths forward

### Path A — Fix Bug A in the SDK (recommended)

The Android SDK has a Compose-specific race that needs an actual fix. This is the better long-term
answer because:

- Every consumer of the Android SDK currently hits this race when an app is launched with a cached
  anonymous profile followed by an `identify()` call.
- The iOS workaround is fragile: it relies on the panel-close re-snapshot which is a side-effect of
  preview-mode behavior, not a general SDK guarantee.
- This unblocks the (A)+(B)+(C) hardening pattern in
  [`triage-preview-panel-overrides.md`](../../triage-preview-panel-overrides.md), which needs
  `setUp` to reliably establish the variant entry before each scenario.

The fix candidates from
[`android-variant-resolution-bug-report.md`](./android-variant-resolution-bug-report.md) are:

1. Replace `LaunchedEffect(selectedPersonalizations)` with
   `LaunchedEffect(Unit) { client.selectedPersonalizations.collect { newValue -> /* lock-once logic */ } }`
   — collects directly from the flow without Compose snapshot conflation. Closest to the intent of
   the original code; likely the smallest diff.
2. Trigger the lock on a stable signal
   (`client.state.profile != null && client.state.canPersonalize`) rather than the first non-null
   `selectedPersonalizations` emission. Waits for an identified-state signal instead of latching on
   the transient cached/anonymous emission.
3. Drop the lock entirely. iOS comments call it out as "to prevent UI flashing." Measure whether it
   is still needed on Android with current rendering. If not, the simplest answer.

Option 1 is the lowest-risk surgical fix. Recommend trying it first and validating with the existing
`PreviewPanelOverridesTests`. If 4/4 pass, the SDK fix is enough by itself — no test changes needed.

### Path B — Migrate Android test to the iOS pattern

If the SDK fix is deferred, the test can be made to pass via the same workaround the iOS suite uses.
Cheaper to land but does not address the underlying bug.

Required changes to
`implementations/android-sdk/uitests/src/main/kotlin/com/contentful/optimization/uitests/tests/PreviewPanelOverridesTests.kt`:

1. **Relax `setUp`**: replace `assertEntryVisible(VARIANT_ENTRY_ID, …)` with an existence check on
   `content-entry-<BASELINE_ENTRY_ID>` (or `content-entry-1JAU028vQ7v6nB2swl3NBo` if migrating to
   the top-level swap).
2. **Switch assertions** from `assertEntryVisible(<resolved-id>)` (which depends on
   `entry-text-<resolved-id>` test tag) to a label/content check on the wrapper. Compose exposes
   both the wrapper testTag and inner testTag in the merged semantics, so `entry-text-<resolved-id>`
   actually works on Android — but only when the resolver produces the expected resolved id. Bug A
   prevents that for the first scenario.

   The relaxation that works for iOS does not improve scenario 1 here, because Android's
   `entry-text-<resolved-id>` selector only matches the resolver's output, not the wrapper's
   baseline id. To replicate the iOS pattern faithfully, switch to reading the merged semantics'
   content description or label that includes `[Entry: <resolved-id>]`, which the wrapper's children
   produce regardless of the inner testTag.

3. **Verify each scenario's open/close pattern** triggers the `LaunchedEffect(isPreviewPanelOpen)`
   re-snapshot. The scenarios already `openPanel()` and `closePanel()` so this should already work,
   but worth confirming that `client.setPreviewPanelOpen(false)` actually fires the
   `isPreviewPanelOpen` state transition in Android's flow plumbing.

Path B is a 30-minute test-only edit. Path A is a focused SDK change to one file in
`packages/android/ContentfulOptimization`.

## Cross-platform parity

iOS currently asserts the top-level `1JAU → 2KIW` swap via experience `1FHhEY`. Android and RN still
drive the nested `5i4S → 5a8O` swap via experience `7Dyid`. Both swaps gate on the same audience
(`4yIqY` Identified Users), so the override scenarios exercise the same SDK surface, but the
specific entry ids differ.

If Path A lands and Android's existing nested-swap assertions pass, parity is preserved on the SDK
level (both suites prove the resolver works end-to-end). If Path B is taken, strongly consider
migrating Android to the top-level swap at the same time so all three suites share the same fixture
ids.

## Recommended sequence

1. **Try Path A first** — apply fix candidate 1 (LaunchedEffect with explicit collect) to
   `packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt:55-58`,
   rebuild, then run:
   ```sh
   STACKS=android-native ./triage-preview-panel-overrides.sh
   ```
   If 4/4 pass, stop. Done.
2. **If Path A fails**, escalate to fix candidate 2 (lock on stable signal). This is slightly larger
   but addresses cases where even the explicit `.collect` hits the same conflation under fast
   emissions.
3. **If still failing**, fall back to Path B (test-only migration) to unblock the Android SDK
   release work, and file Bug A as a known SDK issue for future cleanup.

## Validating the fix

The triage orchestrator already captures everything needed:

- `triage-out/<timestamp>/summary.md` — PASS/FAIL signal per stack.
- `triage-out/<timestamp>/android-native.test.log` — Gradle test runner output.
- `triage-out/<timestamp>/android-native.device.log` — `adb logcat -d` snapshot covering the test
  run.

After landing Path A or B, also run the full RN suites to confirm no regression on the universal SDK
or the shared mock fixtures:

```sh
STACKS='android-native rn-on-android rn-on-ios' ./triage-preview-panel-overrides.sh
```

Expected outcomes after the fix:

| Stack          | Expected | Notes                                                                                                                    |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| android-native | 4/4 PASS | Path A or B applied                                                                                                      |
| rn-on-android  | 4/4 PASS | Already green                                                                                                            |
| rn-on-ios      | 3/4 PASS | Scenario 6 known issue, see [react-native-preview-panel-test-fix-plan.md](./react-native-preview-panel-test-fix-plan.md) |

## What this fix does _not_ address

- **Hardened (A)+(B)+(C) assertion pattern** — the
  [triage doc](../../triage-preview-panel-overrides.md) describes a stronger assertion pattern
  (pre-test anti-leak guard + post-action absence-of-previous-state + post-action
  presence-of-target-scoped-to-wrapper) that is not yet applied to any platform. This is a follow-up
  after all three suites are green.
- **iOS PreviewPanelOverridesTests cross-platform divergence** — iOS asserts the top-level swap,
  Android and RN assert the nested swap. Either migrate iOS back or migrate Android/RN forward; see
  [ios-preview-panel-test-fix-report.md](./ios-preview-panel-test-fix-report.md) for context.
- **iOS preview panel needing `MockPreviewContentfulClient` wiring** — that was a per-implementation
  app gap and is iOS-specific. Android's example app already wires its own
  `MockPreviewContentfulClient`.
