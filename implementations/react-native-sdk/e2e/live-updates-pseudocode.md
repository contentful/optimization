# live-updates.test.js — Live updates behavior

## Goal

`liveUpdates` controls whether already-resolved Optimization variants refresh when the profile
changes (for example, after the user identifies). The default is locked-on-first-value, so a variant
chosen at first resolution stays fixed. The behavior can be opted in globally, set per-component to
override the global setting, or force-enabled for all components while a preview panel is open.

## Constants

- `ENTRY_ID_TEXT_PATTERN`: regular expression `/^Entry: [a-zA-Z0-9]+$/`. Matches the text rendered
  by the `*-entry-id` Text nodes — the segment after `Entry: ` is a Contentful `sys.id`
  (alphanumeric, no spaces). Matching this proves the SDK resolved a real entry rather than
  rendering an empty or default state.

## Test setup

- **beforeAll**: Launch the app.
- **beforeEach**:
  1. Reset profile state — see [clearProfileState](./helpers-pseudocode.md#clearprofilestate).
  2. Wait until the element with test ID `live-updates-test-button` is visible, with a timeout of
     `ELEMENT_VISIBILITY_TIMEOUT` — see
     [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
  3. Tap the element with test ID `live-updates-test-button` (this opens the Live Updates Test
     screen).
  4. Wait until the element with test ID `default-optimization` is visible, with a timeout of
     `ELEMENT_VISIBILITY_TIMEOUT`.
- **afterEach**:
  1. Tap the element with test ID `close-live-updates-test-button` if visible — see
     [tapIfVisibleById](./helpers-pseudocode.md#tapifvisiblebyid).
  2. Wait until the element with test ID `live-updates-test-button` is visible, with a timeout of
     `ELEMENT_VISIBILITY_TIMEOUT` (confirms the screen closed).

## Tests

### Group: "default behavior (locked on first value)"

#### "should NOT update variant when user identifies (global liveUpdates=false)"

**Verifies:** With the global `liveUpdates` setting off, identifying the user does not change the
resolved default entry's variant, while the always-live reference section does change.

**Steps:**

1. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Read the text of the element with test ID `default-entry-id` and store it as the initial default
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
4. Read the text of the element with test ID `live-entry-id` and store it as the initial live entry
   id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
5. Tap the element with test ID `live-updates-identify-button`.
6. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Wait until the element with test ID `live-entry-id` has text different from the stored initial
   live entry id (the `liveUpdates=true` section must re-resolve) — see
   [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).
8. Wait until the element with test ID `default-entry-id` has text equal to the stored initial
   default entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "global liveUpdates enabled"

#### "should update default entries when user identifies"

**Verifies:** When the global `liveUpdates` setting is turned on, identifying the user causes the
default entry to re-resolve to a different variant.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Read the text of the element with test ID `default-entry-id` and store it as the initial default
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
5. Tap the element with test ID `live-updates-identify-button`.
6. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Wait until the element with test ID `default-entry-id` has text different from the stored initial
   default entry id — see [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).

#### "should NOT update locked entries even when global liveUpdates=true"

**Verifies:** A component explicitly opted out of live updates does not refresh even with the global
setting on, while the default section (no per-component prop) does re-resolve.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Read the text of the element with test ID `locked-entry-id` and store it as the initial locked
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
6. Read the text of the element with test ID `default-entry-id` and store it as the initial default
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
7. Tap the element with test ID `live-updates-identify-button`.
8. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
9. Wait until the element with test ID `default-entry-id` has text different from the stored initial
   default entry id (the live reference that proves the SDK swaps variants) — see
   [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).
10. Wait until the element with test ID `locked-entry-id` has text equal to the stored initial
    locked entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "per-component liveUpdates=true"

#### "should update variant regardless of global setting"

**Verifies:** A component with `liveUpdates=true` refreshes on profile change even when the global
setting is off.

**Steps:**

1. Wait until the element with test ID `global-live-updates-status` has text `OFF`, with a timeout
   of `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Read the text of the element with test ID `live-entry-id` and store it as the initial live entry
   id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
4. Tap the element with test ID `live-updates-identify-button`.
5. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
6. Wait until the element with test ID `live-entry-id` has text different from the stored initial
   live entry id — see [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).

### Group: "per-component liveUpdates=false"

#### "should NOT update variant even when global liveUpdates=true"

**Verifies:** A component with `liveUpdates=false` stays locked even when the global setting is on,
while the per-component `liveUpdates=true` section overrides the global setting and re-resolves.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Read the text of the element with test ID `locked-entry-id` and store it as the initial locked
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
6. Read the text of the element with test ID `live-entry-id` and store it as the initial live entry
   id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
7. Tap the element with test ID `live-updates-identify-button`.
8. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
9. Wait until the element with test ID `live-entry-id` has text different from the stored initial
   live entry id — see [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).
10. Wait until the element with test ID `locked-entry-id` has text equal to the stored initial
    locked entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "preview panel simulation"

#### "should enable live updates for all entries when panel is open"

**Verifies:** While the preview panel simulation is open, all three Optimization sections behave as
live and re-resolve to different variants after the user identifies, overriding both global and
per-component settings (including the per-component `liveUpdates=false` section).

**Steps:**

1. Wait until the element with test ID `preview-panel-status` has text `Closed`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Tap the element with test ID `simulate-preview-panel-button`.
3. Wait until the element with test ID `preview-panel-status` has text `Open`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
6. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Read the text of the element with test ID `default-entry-id` and store it as the initial default
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
8. Read the text of the element with test ID `live-entry-id` and store it as the initial live entry
   id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
9. Read the text of the element with test ID `locked-entry-id` and store it as the initial locked
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
10. Tap the element with test ID `live-updates-identify-button`.
11. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
    `ELEMENT_VISIBILITY_TIMEOUT`.
12. Wait until the element with test ID `default-entry-id` has text different from the stored
    initial default entry id — see
    [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).
13. Wait until the element with test ID `live-entry-id` has text different from the stored initial
    live entry id — see [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).
14. Wait until the element with test ID `locked-entry-id` has text different from the stored initial
    locked entry id — see [waitForTextChangeById](./helpers-pseudocode.md#waitfortextchangebyid).

### Group: "screen controls"

#### "should toggle global live updates setting"

**Verifies:** The global live updates toggle control flips the displayed status between `OFF` and
`ON`.

**Steps:**

1. Assert the element with test ID `global-live-updates-status` has text `OFF`.
2. Tap the element with test ID `toggle-global-live-updates-button`.
3. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Tap the element with test ID `toggle-global-live-updates-button`.
5. Wait until the element with test ID `global-live-updates-status` has text `OFF`, with a timeout
   of `ELEMENT_VISIBILITY_TIMEOUT`.

#### "should toggle preview panel simulation"

**Verifies:** The preview panel simulation control flips the displayed status between `Closed` and
`Open`.

**Steps:**

1. Assert the element with test ID `preview-panel-status` has text `Closed`.
2. Tap the element with test ID `simulate-preview-panel-button`.
3. Wait until the element with test ID `preview-panel-status` has text `Open`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Tap the element with test ID `simulate-preview-panel-button`.
5. Wait until the element with test ID `preview-panel-status` has text `Closed`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "should identify and reset user"

**Verifies:** The screen's identify and reset controls correctly flip the identified status between
`No` and `Yes`.

**Steps:**

1. Assert the element with test ID `identified-status` has text `No`.
2. Tap the element with test ID `live-updates-identify-button`.
3. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Tap the element with test ID `live-updates-reset-button`.
5. Wait until the element with test ID `identified-status` has text `No`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.

### Group: "three Optimization sections display"

#### "should display all three Optimization entry sections"

**Verifies:** The Live Updates Test screen renders the default, live, and locked Optimization
section containers, and each section's entry id text matches the SDK-resolved entry id pattern.

**Steps:**

1. Wait until the element with test ID `default-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
6. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Read the text of the element with test ID `default-entry-id` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
8. Read the text of the element with test ID `live-entry-id` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
9. Read the text of the element with test ID `locked-entry-id` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
10. Assert the `default-entry-id` text matches `ENTRY_ID_TEXT_PATTERN`.
11. Assert the `live-entry-id` text matches `ENTRY_ID_TEXT_PATTERN`.
12. Assert the `locked-entry-id` text matches `ENTRY_ID_TEXT_PATTERN`.

#### "should display entry content in all sections"

**Verifies:** Each of the three Optimization sections renders its container and a non-empty,
non-fallback text field, and before any identify/toggle/preview-panel action all three sections
resolve to the same variant text.

**Steps:**

1. Wait until the element with test ID `default-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Read the text of the element with test ID `default-text` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
5. Read the text of the element with test ID `live-text` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
6. Read the text of the element with test ID `locked-text` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
7. Assert the `default-text` length is greater than 0.
8. Assert the `live-text` length is greater than 0.
9. Assert the `locked-text` length is greater than 0.
10. Assert the `default-text` is not equal to `No content`.
11. Assert the `live-text` is not equal to `No content`.
12. Assert the `locked-text` is not equal to `No content`.
13. Assert the `default-text` equals the `live-text`.
14. Assert the `default-text` equals the `locked-text`.
