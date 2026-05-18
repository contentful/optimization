# Android variant resolution: two bugs uncovered while hardening PreviewPanelOverridesTests

## Context

While hardening `implementations/android-sdk/uitests/.../PreviewPanelOverridesTests.kt` to mirror
the iOS test (replacing fuzzy `assertEntryContentContains("baseline" | "variant")` substring matches
with strong `assertEntryVisible(<exact resolved entry id>)` assertions, committed as `bddf56c2`),
the new assertion failed at the very first precondition:

> Expected variant entry to render after identify (`entry-text-5a8ONfBdanJtlJ39WWnH1w` not found)

iOS's `PreviewPanelOverridesTests.testScenario4SettingVariantOverrideToZeroRendersBaseline` and the
shared mock fixture (`lib/mocks/src/experience/data/identified-visitor.json`) both assume that after
`identify` the visitor sees the **variant** entry `5a8ONfBdanJtlJ39WWnH1w` (resolved from baseline
`5i4SdJXw9oDEY0vgO7CwF4` via experience `7DyidZaPB7Jr1gWKjoogg0`). On Android we get the baseline
`5i4SdJXw9oDEY0vgO7CwF4` instead. The previously-passing Android tests were matching the fuzzy
substring `"baseline"` against the wrong rendered state and passing inadvertently.

Two distinct bugs are at play. Bypassing the first reveals the second.

## Bug A — `OptimizedEntry` lock-on-first-non-null races against the state stream

`packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/compose/OptimizedEntry.kt:55-58`

```kotlin
LaunchedEffect(selectedPersonalizations) {
    if (isPersonalized && !shouldLiveUpdate && !isLocked && selectedPersonalizations != null) {
        lockedPersonalizations = selectedPersonalizations
        isLocked = true
    }
}
```

### Observed sequence during setUp

```
T+0    ms  state stream: 20 entries (cached identified) — includes 1FHhEY, 7Dyid
T+200  ms  state stream: 11 entries (anonymous)         — clearProfileState wiped
T+1100 ms  state stream: 20 entries (re-identified)
logged    [PERSONALIZE] in=1JAU pCount=11 out=1JAU       — locked onto the anonymous list
```

### Root cause

`selectedPersonalizations` is read via `client.selectedPersonalizations.collectAsState()`.
`StateFlow` + `collectAsState` conflates fast emissions through Compose's snapshot system — only the
latest value latches into State per recomposition. `LaunchedEffect(key)` fires once per **observed**
key change, so a rapid `null → 20 → 11` is collapsed and the effect runs once with `key = 11`. The
lock captures `11`, `isLocked = true`, and the subsequent re-emission to `20` is ignored.

iOS uses Combine `.onReceive(client.$selectedPersonalizations)` which fires per emission. The first
emission `20` is observed, the lock is set, the subsequent `11` is filtered by the `!isLocked`
guard.

### Proof

Forcing `effectivePersonalizations = selectedPersonalizations` (no lock) in `OptimizedEntry.kt`
flips the top-level resolution from baseline `1JAU` to variant `2KIW`. Visible accessibility tags
went from `entry-text-1JAU028vQ7v6nB2swl3NBo` to `entry-text-2KIWllNZJT205BwOSkMINg`.

### Fix candidates

- Replace `LaunchedEffect(state)` with
  `LaunchedEffect(Unit) { client.selectedPersonalizations .collect { newValue -> /* lock-once logic */ } }`
  — collects directly from the flow without Compose snapshot conflation.
- Trigger the lock on a stable signal
  (`client.state.profile != null && client.state .canPersonalize`) rather than the first non-null
  personalizations emission, so the lock waits for an identified state instead of latching on a
  transient cached/anonymous state.
- Drop the lock entirely. iOS comments call it out as "to prevent UI flashing" — measure whether it
  is still needed on Android with current rendering.

## Bug B — Resolver returns baseline for the nested `5i4Sd` even with correct personalizations

`packages/universal/core-sdk/src/resolvers/OptimizedEntryResolver.ts:90-142`

With Bug A bypassed, `personalizeEntry(5i4Sd, pCount=20)` is called with the full identified list
including the `7Dyid` personalization `{ variantIndex: 1, variants: { 5i4Sd → 5a8O } }`. The bridge
returns `5i4Sd` unchanged.

### Root cause

`5i4Sd.fields.nt_experiences = [1FHhEY]` — points only to its **parent** experience, not its own
(`7Dyid`). The resolver's flow:

1. `getOptimizationEntry({ optimizedEntry: 5i4Sd, selectedOptimizations })` finds `1FHhEY` matched
   (it is in `5i4Sd.nt_experiences` AND in `selectedOptimizations`).
2. `1FHhEY` has `variantIndex = 1`.
3. `getSelectedVariant` looks up the variant in `1FHhEY`'s `variants` map — `{ 1JAU → 2KIW }`.
   `5i4Sd` is not a key. `selectedVariant` is null.
4. Logs `could not find a valid replacement variant entry for 5i4Sd`, returns `5i4Sd` unchanged.

The resolver never iterates `selectedOptimizations` looking for an optimization whose `variants` map
contains `5i4Sd` as a key (which would find `7Dyid`). It only considers experiences listed in the
input entry's own `nt_experiences`.

### Fix candidates

- **Fixture fix.** Add `7Dyid` to `5i4Sd.fields.nt_experiences` in
  `lib/mocks/src/contentful/data/space/ctfl-space-data.json`. If real Contentful spaces produce
  `nt_experiences` listing every experience an entry participates in (including as a baseline), this
  is just a fixture omission and the SDK is correct as-is.
- **Resolver fix.** Add a fallback that searches `selectedOptimizations` for an optimization whose
  `variants` map keys off the input entry's id, independent of `nt_experiences`. Larger change;
  affects iOS too.

## iOS verification gap

The iOS `PreviewPanelOverridesTests` setUp asserts `entry-text-5a8O` after identify, but the recent
main-pipeline successes I sampled were on docs-only commits where the
`.github/workflows/main-pipeline.yaml` `e2e_ios` path filter skips iOS E2E entirely. There is
currently no evidence that scenario 2's setUp precondition passes on iOS in CI. Worth confirming
before assuming iOS is the source of truth — it is plausible that iOS hits Bug B too and the suite
just has not been exercised since the fixture or resolver landed in their current shape.

## Reproducing

1. Check out `NT-2885-build-android-sdk` at `bddf56c2`.
2. Run the e2e suite locally:
   ```sh
   cd implementations/android-sdk
   ./scripts/run-e2e.sh --test-class PreviewPanelOverridesTests
   ```
3. Expect all four scenarios to fail at the setUp precondition with the message
   `Expected variant entry to render after identify (entry-text-5a8ONfBdanJtlJ39WWnH1w not found; visible entry-text-* tags: [entry-text-7pa5bOx8Z9NmNcr7mISvD, entry-text-1JAU028vQ7v6nB2swl3NBo, entry-text-5i4SdJXw9oDEY0vgO7CwF4, entry-text-uaNY4YJ0HFPAX3gKXiRdX])`.
