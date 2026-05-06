# Preview panel E2E scenarios (cross-platform contract)

This document is the **shared contract** driving preview-panel E2E tests on both React Native
(Detox) and iOS (XCUITest). Both suites MUST mirror scenario names, data, and expected observations
so cross-platform drift is immediately visible when diffing test output.

## Why these tests exist

The shared `PreviewOverrideManager`
(`packages/universal/core-sdk/src/lib/preview/PreviewOverrideManager.ts`) has strong unit coverage.
These E2E tests exist to verify the **thin platform wrappers** correctly:

1. Invoke manager methods from UI controls
2. Propagate signal changes through to rendered content
3. Preserve overrides across API refresh (interceptor path)

The E2E suite deliberately does **not** re-test manager logic (variant arithmetic, multi-index
scenarios, etc.) — that is already unit-covered.

## Harness requirements

**Preconditions for both platforms:**

- Mock server running at `localhost:8000` (`pnpm --filter @contentful/optimization-mocks serve`)
- Reference app identifies as an "identified visitor" so `identified-visitor.json` is served
- App launched fresh (no cached overrides)

**Assertion style:** rendered-content only. Each scenario drives preview-panel UI then observes
`entry-text-{entryId}` visibility. No debug-state labels are injected into the panel.

## Fixture data

All scenarios use:

- **Test audience**: `4yIqY7AWtzeehCZxtQSDB` ("Identified Users") — user qualifies naturally
- **Test experience**: `7DyidZaPB7Jr1gWKjoogg0` ("Personalization Nested Level 1"), audience-linked
  to the test audience
  - Baseline entry: `5i4SdJXw9oDEY0vgO7CwF4` — text "This is a level 1 nested baseline entry."
  - Variant entry: `5a8ONfBdanJtlJ39WWnH1w` — text "This is a level 1 nested variant entry."
- **Secondary experience**: `6IueRX1pS3iMJncbhUQTba` ("Personalization Nested Level 2"), also
  audience-linked
  - Baseline entry: `uaNY4YJ0HFPAX3gKXiRdX` — "baseline level 2"
  - Variant entry: `4hDiXxYEFrXHXcQgmdL9Uv` — "variant level 2"

Default state for an identified user: both experiences render their **variant** entries
(`5a8ONfBdanJtlJ39WWnH1w`, `4hDiXxYEFrXHXcQgmdL9Uv`). This is already asserted by
`displays-identified-user-variants.test.js` and `IdentifiedVariantsTests.swift` and serves as the
pre-test baseline.

## Shared accessibility identifiers / testIDs

| Control                            | ID                                                    |
| ---------------------------------- | ----------------------------------------------------- |
| Open preview panel (FAB)           | `preview-panel-fab`                                   |
| Close preview panel                | `preview-panel-close`                                 |
| Audience toggle (On/Default/Off)   | `audience-toggle-{audienceId}-{on\|default\|off}`     |
| Audience toggle container          | `audience-toggle-{audienceId}` (RN only — radiogroup) |
| Variant picker (per option)        | `variant-picker-{experienceId}-{index}`               |
| Reset individual audience override | `reset-audience-{audienceId}`                         |
| Reset individual variant override  | `reset-variant-{experienceId}`                        |
| Reset all overrides (footer)       | `reset-all-overrides`                                 |

Identifiers are identical on iOS (accessibilityIdentifier) and RN (testID). Keep them in sync when
adding new controls.

## Scenarios

Each scenario: open panel → drive UI → close panel → assert rendered content. `TEST_EXPERIENCE_ID`
below = `7DyidZaPB7Jr1gWKjoogg0`, `TEST_AUDIENCE_ID` = `4yIqY7AWtzeehCZxtQSDB`.

### 1. Activate an unqualified audience renders variants

Starting state: user is _not_ qualified for some audience X (pick one absent from
`profile.audiences` in the mock). Rendered entries linked to X show baseline.

Drive:

1. Tap `preview-panel-fab`
2. Tap `audience-toggle-{X}-on`
3. Tap `preview-panel-close`

Assert: entries linked to X now render their variant text.

> [!NOTE]
>
> This scenario requires an audience the identified user does not qualify for. If the mock's
> identified profile qualifies for every audience with content, extend the mock to add one
> unqualified audience and experience. Skip the scenario if it is not possible, and log it as a
> known gap.

### 2. Deactivate a qualified audience renders baselines

Starting state: user qualifies for `TEST_AUDIENCE_ID`, `TEST_EXPERIENCE_ID` renders variant
`5a8ONfBdanJtlJ39WWnH1w`.

Drive:

1. Tap `preview-panel-fab`
2. Tap `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off`
3. Tap `preview-panel-close`

Assert: `entry-text-5i4SdJXw9oDEY0vgO7CwF4` (baseline) visible; variant no longer visible.

### 3. Reset audience override restores qualified state

Continuing from scenario 2 (audience is deactivated, baseline visible).

Drive:

1. Tap `preview-panel-fab`
2. Tap `audience-toggle-4yIqY7AWtzeehCZxtQSDB-default`
3. Tap `preview-panel-close`

Assert: `entry-text-5a8ONfBdanJtlJ39WWnH1w` (variant) visible again.

### 4. Set variant override to baseline renders baseline

Starting state: experience renders variant.

Drive:

1. Tap `preview-panel-fab`
2. Expand `TEST_AUDIENCE_ID` audience if needed
3. Tap `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0`
4. Tap `preview-panel-close`

Assert: `entry-text-5i4SdJXw9oDEY0vgO7CwF4` (baseline) visible.

### 5. Reset single variant override restores default

Continuing from scenario 4 (variant override to index 0 set).

Drive:

1. Tap `preview-panel-fab`
2. Scroll to Overrides section
3. Tap `reset-variant-7DyidZaPB7Jr1gWKjoogg0`
4. Confirm the alert (iOS: "Reset" button; RN: Alert "Reset" button)
5. Tap `preview-panel-close`

Assert: variant content visible again.

### 6. Reset all overrides restores every experience

Setup: drive scenarios 2 + 4 so both an audience override and a variant override exist.

Drive:

1. Tap `preview-panel-fab`
2. Scroll to footer
3. Tap `reset-all-overrides`
4. Confirm alert ("Reset")
5. Tap `preview-panel-close`

Assert: all test experiences render their default (variant) content.

### 7. Override survives API refresh

Setup: drive scenario 2 (audience deactivated, baseline rendering).

Drive:

1. Tap `preview-panel-fab`
2. Tap `preview-refresh-button` (existing)
3. Tap `preview-panel-close`

Assert: baseline still rendering — the interceptor preserved the override through the API refresh.

### 8. Destroy/remount — overrides do not leak

Drive: set an override (scenario 2), close the app via platform API (`device.terminateApp()` /
`app.terminate()`), relaunch.

Assert: test experience renders default (variant) content; preview panel Overrides section empty.

## Running locally

- **RN (Android)**:
  `pnpm --filter @contentful/optimization-react-native-reference-app test:e2e:android` (or iOS sim
  equivalent)
- **iOS native**:
  `xcodebuild test -scheme OptimizationApp -only-testing:OptimizationAppUITests/PreviewPanelOverridesTests -destination 'platform=iOS Simulator,name=iPhone 16'`

## Gaps / known limitations

- **Scenario 1** (activate unqualified audience) unverifiable until the mock is extended with an
  audience the identified user does not qualify for. Document as TODO on the test, or adjust the
  mock profile.
- **Multi-index variant pickers**: all mock experiences are binary (index 0 or 1). Higher-index
  arithmetic is unit-tested at manager level.
