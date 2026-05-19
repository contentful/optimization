# navigation-screen-tracking.test.js — Navigation screen tracking

## Goal

Verifies that the SDK fires screen-tracking events when the host application navigates between
screens. Each visited view should produce an ordered entry in the screen-event log, including repeat
visits to the same view after backward navigation. The log captures the navigation history from the
home screen through any number of subsequent view transitions in the exact order they occurred.

## Test setup

- **beforeAll**: Launch the application. Disable test-runner UI synchronization so manual waits and
  polls drive timing instead of automatic idle synchronization.
- **beforeEach**: Reset profile state and require a fresh app instance — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).
- **afterAll**: Re-enable test-runner UI synchronization.

## Helper used in this file

`getScreenEventLogText` reads the element with test ID `screen-event-log` and returns its visible
text (or its accessibility label when text is unavailable) as a string. Use this to read the
comma-separated screen-event log between assertions.

## Tests

### "should track a single view visit"

**Verifies:** Navigating from the home screen into View One produces the ordered screen-event log
`NavigationHome,NavigationViewOne`.

**Steps:**

1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-test-button` to be visible.
2. Tap the element with test ID `navigation-test-button`.
3. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `go-to-view-one-button` to be visible.
4. Tap the element with test ID `go-to-view-one-button`.
5. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-view-test-one` to be visible.
6. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `screen-event-log` to be visible.
7. Read the screen-event log text via `getScreenEventLogText`.
8. Assert the screen-event log text equals exactly `NavigationHome,NavigationViewOne`.

### "should track multiple view visits in order"

**Verifies:** Navigating from the home screen into View One and then into View Two produces a
screen-event log containing both views, with `NavigationViewOne` appearing before
`NavigationViewTwo`.

**Steps:**

1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-test-button` to be visible.
2. Tap the element with test ID `navigation-test-button`.
3. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `go-to-view-one-button` to be visible.
4. Tap the element with test ID `go-to-view-one-button`.
5. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-view-test-one` to be visible.
6. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `go-to-view-two-button` to be visible.
7. Tap the element with test ID `go-to-view-two-button`.
8. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-view-test-two` to be visible.
9. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `screen-event-log` to be visible.
10. Read the screen-event log text via `getScreenEventLogText`.
11. Compute the index of the substring `NavigationViewOne` in the log text.
12. Compute the index of the substring `NavigationViewTwo` in the log text.
13. Assert the index of `NavigationViewOne` is greater than or equal to `0` (it is present in the
    log).
14. Assert the index of `NavigationViewTwo` is strictly greater than the index of
    `NavigationViewOne` (View Two appears after View One in the log).

### "should track revisiting view one after view two"

**Verifies:** After navigating Home → View One → View Two and then returning to the previous screen,
the screen-event log records the revisit to View One, producing the exact ordered log
`NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne`.

**Steps:**

1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-test-button` to be visible.
2. Tap the element with test ID `navigation-test-button`.
3. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `go-to-view-one-button` to be visible.
4. Tap the element with test ID `go-to-view-one-button`.
5. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-view-test-one` to be visible.
6. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `go-to-view-two-button` to be visible.
7. Tap the element with test ID `go-to-view-two-button`.
8. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with test ID `navigation-view-test-two` to be visible.
9. Trigger the platform back navigation (return to the previous screen).
10. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
    for the element with test ID `navigation-view-test-one` to be visible again.
11. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
    for the element with test ID `screen-event-log` to be visible.
12. Read the screen-event log text via `getScreenEventLogText`.
13. Assert the screen-event log text equals exactly
    `NavigationHome,NavigationViewOne,NavigationViewTwo,NavigationViewOne`.
