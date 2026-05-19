# preview-panel-overrides.test.js — Preview panel overrides

## Goal

The preview panel lets developers override audience membership and experience variant selection at
runtime so they can preview each variant without changing the underlying visitor profile. This test
file verifies that an audience override can activate an unqualified audience or deactivate a
qualified one, that a per-experience variant index can be forced, that overrides can be reset
individually or in bulk, that audience overrides survive an in-panel API refresh, and that a cold
relaunch with cleared storage wipes all overrides so the identified-visitor baseline renders again.

## Test setup

- **beforeEach**:
  1. Relaunch the app as a new instance with fresh storage so prior modal and override state cannot
     leak in.
  2. Reset profile state — see [clearProfileState](./helpers-pseudocode.md#clearprofilestate).
  3. Run the local `identifyAndRelaunch` helper — see Local helpers below.

## Local helpers

1. **`identifyAndRelaunch`** — identifies the visitor, then relaunches so the identified-visitor
   mock payload is re-fetched on a fresh app start.
   1. Wait until the element with test ID `identify-button` is visible, with timeout
      `ELEMENT_VISIBILITY_TIMEOUT` — see
      [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
   2. Tap the element with test ID `identify-button`.
   3. Wait until the element with test ID `reset-button` is visible, with timeout
      `ELEMENT_VISIBILITY_TIMEOUT`.
   4. Terminate the app.
   5. Relaunch the app as a new instance.
   6. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` exists, with timeout
      `ELEMENT_VISIBILITY_TIMEOUT`, confirming the identified-visitor profile renders variant
      entries by default.

2. **`openPanel`** — opens the preview panel modal from the floating action button.
   1. Wait until the element with test ID `preview-panel-fab` exists, with timeout
      `ELEMENT_VISIBILITY_TIMEOUT`.
   2. Tap the element with test ID `preview-panel-fab`.
   3. Wait until an element with visible text `Preview Panel` is visible, with timeout
      `ELEMENT_VISIBILITY_TIMEOUT`.

3. **`scrollPanelToId(testId)`** — scrolls the preview panel's internal scroll view until the
   requested element is visible and tappable. The panel is tall and the target audiences and
   controls typically sit below the fold.
   1. Wait until the element with test ID `testId` is visible while scrolling the element with test
      ID `preview-panel-scroll` downward by `300` pixels per step.

4. **`closePanel`** — dismisses the preview panel modal. Uses the platform's back gesture where
   available; otherwise falls back to the explicit close button.
   1. Attempt the system back press to dismiss the modal (fires the modal's request-close on
      platforms with a hardware/gesture back; behaves as standard swipe-to-dismiss elsewhere).
   2. If that is not available, check whether the element with test ID `preview-panel-close` is
      visible with timeout `1000` ms, and if so tap it — see
      [isVisibleById](./helpers-pseudocode.md#isvisiblebyid).

## Tests

### Group: "preview panel overrides"

#### "scenario 1: activating unqualified audience renders its variant"

**Verifies:** turning on an audience that the identified visitor does not qualify for activates an
experience whose variant content then renders on screen.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-3MRuZPQ5EdwDqzUDRgOo7c-on` is
   visible — see local helper `scrollPanelToId`.
3. Tap the element with test ID `audience-toggle-3MRuZPQ5EdwDqzUDRgOo7c-on`.
4. Close the panel — see local helper `closePanel`.
5. Wait until an element with accessibility label
   `This is a variant content entry for visitors using a mobile browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]`
   exists, with timeout `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 2: deactivating qualified audience renders baseline"

**Verifies:** turning off an audience the identified visitor does qualify for forces the experience
to fall back to its baseline entry.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off`.
4. Close the panel.
5. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 3: resetting audience override restores variant"

**Verifies:** after deactivating a qualified audience, tapping the audience's default toggle removes
the override and restores the original variant resolution.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off`.
4. Tap the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-default`.
5. Close the panel.
6. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 4: setting variant override to 0 renders baseline"

**Verifies:** explicitly picking the index-0 (baseline) variant for an experience forces that
experience to render its baseline entry, even when the visitor qualifies for a non-baseline variant.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible (this also brings the audience row that owns the experience into view).
3. Tap the element with visible text `Identified Users` to expand the audience row and mount the
   experience variant picker.
4. Scroll the panel until the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0` is
   visible.
5. Tap the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0`.
6. Close the panel.
7. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 5: resetting single variant override restores variant"

**Verifies:** after forcing a variant override, tapping the per-experience reset control and
confirming the native alert removes only that override and restores the original variant resolution.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with visible text `Identified Users` to expand the audience row.
4. Scroll the panel until the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0` is
   visible.
5. Tap the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0`.
6. Scroll the panel until the element with test ID `reset-variant-7DyidZaPB7Jr1gWKjoogg0` is
   visible.
7. Tap the element with test ID `reset-variant-7DyidZaPB7Jr1gWKjoogg0`.
8. Confirm the native alert by tapping the button labeled `Reset` — see
   [tapAlertButton](./helpers-pseudocode.md#tapalertbutton).
9. Close the panel.
10. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` exists, with timeout
    `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 6: reset-all restores variant content"

**Verifies:** after forcing a variant override, tapping the panel's reset-all control and confirming
via the inline confirm view clears every override and restores the original variant resolution.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with visible text `Identified Users` to expand the audience row.
4. Scroll the panel until the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0` is
   visible.
5. Tap the element with test ID `variant-picker-7DyidZaPB7Jr1gWKjoogg0-0`.
6. Scroll the panel until the element with test ID `reset-all-overrides` is visible.
7. Tap the element with test ID `reset-all-overrides`.
8. Wait until the element with test ID `reset-all-confirm` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
9. Tap the element with test ID `reset-all-confirm`.
10. Close the panel.
11. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` exists, with timeout
    `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 7: override survives API refresh"

**Verifies:** deactivating an audience and then triggering the in-panel refresh (which re-hits the
experience API) keeps the audience override in place so the experience still resolves to its
baseline.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off`.
4. Scroll the panel until the element with test ID `preview-refresh-button` is visible.
5. Tap the element with test ID `preview-refresh-button`.
6. Close the panel.
7. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "scenario 8: destroy/remount clears overrides"

**Verifies:** a cold relaunch with cleared storage discards all overrides — the variant renders
again and the overrides section reports that none remain.

**Steps:**

1. Open the preview panel — see local helper `openPanel`.
2. Scroll the panel until the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off` is
   visible.
3. Tap the element with test ID `audience-toggle-4yIqY7AWtzeehCZxtQSDB-off`.
4. Close the panel.
5. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
6. Terminate the app.
7. Relaunch the app as a new instance with fresh storage.
8. Run the local `identifyAndRelaunch` helper to re-identify the visitor and rehydrate state.
9. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` exists, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`, confirming the override is gone and the variant renders again.
10. Open the preview panel — see local helper `openPanel`.
11. Scroll the panel until the element with test ID `reset-all-overrides` is visible (this also
    pulls the overrides section into the viewport, since the empty-state text sits below the fold).
12. Assert that an element with visible text `No active overrides` exists.
13. Close the panel.
