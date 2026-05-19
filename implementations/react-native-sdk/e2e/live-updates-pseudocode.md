# live-updates.test.js — Live updates behavior

## Goal

`liveUpdates` controls whether already-resolved Optimization variants refresh when the profile
changes (for example, after the user identifies). The default is locked-on-first-value, so a variant
chosen at first resolution stays fixed. The behavior can be opted in globally, set per-component to
override the global setting, or force-enabled for all components while a preview panel is open.

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
resolved default entry's variant.

**Steps:**

1. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Read the text of the element with test ID `default-entry-id` and store it as the initial default
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
3. Tap the element with test ID `live-updates-identify-button`.
4. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Wait until the element with test ID `default-entry-id` has text equal to the stored initial
   default entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "global liveUpdates enabled"

#### "should update default entries when user identifies"

**Verifies:** When the global `liveUpdates` setting is turned on, identifying the user causes the
default entry to re-resolve and remain rendered.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `default-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Tap the element with test ID `live-updates-identify-button`.
5. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
6. Assert the element with test ID `default-entry-id` is visible.

#### "should NOT update locked entries even when global liveUpdates=true"

**Verifies:** A component explicitly opted out of live updates does not refresh even with the global
setting on.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Read the text of the element with test ID `locked-entry-id` and store it as the initial locked
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
5. Tap the element with test ID `live-updates-identify-button`.
6. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Wait until the element with test ID `locked-entry-id` has text equal to the stored initial locked
   entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "per-component liveUpdates=true"

#### "should update variant regardless of global setting"

**Verifies:** A component with `liveUpdates=true` refreshes on profile change even when the global
setting is off.

**Steps:**

1. Wait until the element with test ID `global-live-updates-status` has text `OFF`, with a timeout
   of `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Tap the element with test ID `live-updates-identify-button`.
4. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Assert the element with test ID `live-entry-id` is visible.

### Group: "per-component liveUpdates=false"

#### "should NOT update variant even when global liveUpdates=true"

**Verifies:** A component with `liveUpdates=false` stays locked even when the global setting is on.

**Steps:**

1. Tap the element with test ID `toggle-global-live-updates-button`.
2. Wait until the element with test ID `global-live-updates-status` has text `ON`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-entry-id` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Read the text of the element with test ID `locked-entry-id` and store it as the initial locked
   entry id — see [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
5. Tap the element with test ID `live-updates-identify-button`.
6. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
7. Wait until the element with test ID `locked-entry-id` has text equal to the stored initial locked
   entry id — see [waitForTextEqualsById](./helpers-pseudocode.md#waitfortextequalsbyid).

### Group: "preview panel simulation"

#### "should enable live updates for all entries when panel is open"

**Verifies:** While the preview panel simulation is open, all three Optimization sections behave as
live and remain rendered after the user identifies, overriding both global and per-component
settings.

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
7. Tap the element with test ID `live-updates-identify-button`.
8. Wait until the element with test ID `identified-status` has text `Yes`, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
9. Assert the element with test ID `default-entry-id` is visible.
10. Assert the element with test ID `live-entry-id` is visible.
11. Assert the element with test ID `locked-entry-id` is visible.

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
section containers.

**Steps:**

1. Wait until the element with test ID `default-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-optimization` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.

#### "should display entry content in all sections"

**Verifies:** Each of the three Optimization sections renders its container, text, and entry id
elements.

**Steps:**

1. Wait until the element with test ID `default-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until the element with test ID `live-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
3. Wait until the element with test ID `locked-container` is visible, with a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Assert the element with test ID `default-text` is visible.
5. Assert the element with test ID `live-text` is visible.
6. Assert the element with test ID `locked-text` is visible.
7. Assert the element with test ID `default-entry-id` is visible.
8. Assert the element with test ID `live-entry-id` is visible.
9. Assert the element with test ID `locked-entry-id` is visible.
