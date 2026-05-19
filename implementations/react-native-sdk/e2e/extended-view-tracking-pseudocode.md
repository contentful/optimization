# extended-view-tracking.test.js — Extended view tracking

## Goal

Verify that the SDK continuously tracks the visibility of content entries on screen, emitting an
initial view event after a dwell threshold of approximately 2000 ms, periodic update events at
roughly 5000 ms intervals while the entry remains visible, and a final event when the visibility
cycle ends (entry scrolled out of view, unmounted, or app backgrounded). Each visibility cycle must
produce a stable `viewId` for its duration, a fresh `viewId` for any subsequent cycle, and a
`viewDurationMs` that monotonically grows within a cycle and resets at the start of a new cycle.
Multiple simultaneously visible entries must be tracked independently, and entries that leave the
viewport before the dwell threshold must produce zero events.

## Constants

- `VISIBLE_ENTRY_ID = "1MwiFl4z7gkwqGYdvCmr8c"` — the merge tag entry that is always first in the
  list and visible immediately on launch.
- `SECOND_ENTRY_ID = "4ib0hsHWoSOnCVdDkizE8d"` — the second entry visible on launch, immediately
  after the merge tag entry.
- `BELOW_FOLD_ENTRY_ID = "7pa5bOx8Z9NmNcr7mISvD"` — an entry that starts below the fold and is not
  visible on launch.
- `EXTENDED_TIMEOUT = 30000` ms — extended timeout for periodic-event tests, sized to cover the
  dwell threshold (~2000 ms) plus one or more update intervals (~5000 ms each).

## Test setup

- **beforeAll**: Launch the app.
- **beforeEach**: Clear profile state and require a fresh app instance — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate) (pass
  `{ requireFreshAppInstance: true }`).

## Tests

### "should emit periodic events for a continuously visible entry"

**Verifies:** A continuously visible entry produces both an initial event (after the dwell
threshold) and at least one subsequent periodic update event.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Wait until the entry `VISIBLE_ENTRY_ID` has at least 2 tracked events, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).

### "should report increasing viewDurationMs across periodic events"

**Verifies:** The reported `viewDurationMs` exceeds the dwell threshold after at least two events,
confirming the duration accumulates across periodic updates within a cycle.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 2 tracked events, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewDurationMs` for `VISIBLE_ENTRY_ID` — see
   [getViewDuration](./helpers-pseudocode.md#getviewduration).
4. Assert that the duration is greater than 2000 ms.

### "should maintain a stable viewId within a visibility cycle"

**Verifies:** Within a single visibility cycle, the entry's `viewId` is a non-empty string that does
not change between events.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 2 tracked events, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewId` for `VISIBLE_ENTRY_ID` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
4. Assert that the `viewId` is not null.
5. Assert that the `viewId` is a string.
6. Assert that the `viewId` length is greater than 0.

### "should emit a final event when scrolling a tracked entry out of view"

**Verifies:** Scrolling a currently tracked entry out of the viewport triggers a final event, the
event count increments, and the cycle's `viewId` remains unchanged through that final event.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `preScrollViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
4. Scroll the element with test ID `main-scroll-view` downward by 1500 units.
5. Sleep for 1000 ms to allow the final event to fire — see [sleep](./helpers-pseudocode.md#sleep).
6. Scroll the element with test ID `main-scroll-view` back to its top.
7. Scroll the element with test ID `main-scroll-view` downward in increments of 300 units until the
   element with test ID `event-count-${VISIBLE_ENTRY_ID}` is visible.
8. Wait until the entry `VISIBLE_ENTRY_ID` has at least 2 tracked events, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
9. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `postScrollViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
10. Assert that `postScrollViewId` equals `preScrollViewId`.

### "should generate a new viewId after scrolling away and back"

**Verifies:** Scrolling an entry out of view ends its cycle, and scrolling it back into view starts
a new cycle with a different `viewId`.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `firstCycleViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
4. Scroll the element with test ID `main-scroll-view` downward by 1500 units.
5. Sleep for 1000 ms — see [sleep](./helpers-pseudocode.md#sleep).
6. Scroll the element with test ID `main-scroll-view` back to its top.
7. Sleep for 500 ms — see [sleep](./helpers-pseudocode.md#sleep).
8. Wait until the entry `VISIBLE_ENTRY_ID` has at least 3 tracked events, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
9. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `secondCycleViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
10. Assert that `secondCycleViewId` is not null.
11. Assert that `secondCycleViewId` does not equal `firstCycleViewId`.

### "should emit zero events when entry scrolls out before dwell threshold"

**Verifies:** An entry that is visible for less than the dwell threshold emits no events at all,
confirming tracking is cancelled before the initial event would have fired.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Scroll the element with test ID `main-scroll-view` downward in increments of 300 units until the
   element with test ID `content-entry-${BELOW_FOLD_ENTRY_ID}` is visible.
3. Immediately scroll the element with test ID `main-scroll-view` back to its top (the below-fold
   entry was visible for well under 2000 ms).
4. Sleep for 3000 ms, long enough that an event would have fired if tracking had not been cancelled
   — see [sleep](./helpers-pseudocode.md#sleep).
5. Check whether the element with test ID `entry-stats-${BELOW_FOLD_ENTRY_ID}` is visible, using a
   2000 ms timeout — see [isVisibleById](./helpers-pseudocode.md#isvisiblebyid).
6. Assert that the visibility result is `false` (the stats element only renders once an entry view
   event has fired, so its absence confirms zero events).

### "should track multiple visible entries simultaneously with independent viewIds"

**Verifies:** Two entries that are simultaneously visible each produce their own tracking events
with distinct, non-null `viewId` values.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Wait until the entry `SECOND_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
4. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `viewId1` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
5. Read the current `viewId` for `SECOND_ENTRY_ID` and store it as `viewId2` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
6. Assert that `viewId1` is not null.
7. Assert that `viewId2` is not null.
8. Assert that `viewId1` does not equal `viewId2`.

### "should emit a final event when navigating away (unmount) during active tracking"

**Verifies:** Navigating away from the screen while an entry is being tracked unmounts the tracked
elements and triggers a final event, increasing the entry's event count when the user returns to the
screen.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the text of the element with test ID `event-count-${VISIBLE_ENTRY_ID}` — see
   [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
4. Parse that text against the regex `/Count:\s*(\d+)/` and store the captured number as
   `preNavCount` (default to 0 if no match).
5. Attempt to scroll the element with test ID `main-scroll-view` back to its top so the navigation
   button is accessible; ignore any failure if the scroll view is not scrollable.
6. Tap the element with test ID `navigation-test-button`.
7. Wait until the element with test ID `close-navigation-test-button` is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
8. Sleep for 500 ms to allow the final event to fire — see [sleep](./helpers-pseudocode.md#sleep).
9. Tap the element with test ID `close-navigation-test-button` to navigate back.
10. Wait until the element with text "Analytics Events" is visible again, using
    `ELEMENT_VISIBILITY_TIMEOUT` — see
    [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
11. Scroll the element with test ID `main-scroll-view` downward in increments of 300 units until the
    element with test ID `event-count-${VISIBLE_ENTRY_ID}` is visible.
12. Read the text of the element with test ID `event-count-${VISIBLE_ENTRY_ID}` — see
    [getElementTextById](./helpers-pseudocode.md#getelementtextbyid).
13. Parse that text against the regex `/Count:\s*(\d+)/` and store the captured number as
    `postNavCount` (default to 0 if no match).
14. Assert that `postNavCount` is greater than `preNavCount`.

### "should pause tracking on app background and resume on foreground"

**Verifies:** Sending the app to the background ends the current visibility cycle (emitting a final
event), and bringing it back to the foreground starts a new cycle with a different `viewId`.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 1 tracked event, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `preBackgroundViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
4. Send the app to home (background).
5. Sleep for 1000 ms — see [sleep](./helpers-pseudocode.md#sleep).
6. Relaunch the app without resetting state (resume from background).
7. Scroll the element with test ID `main-scroll-view` downward in increments of 300 units until the
   element with test ID `event-count-${VISIBLE_ENTRY_ID}` is visible.
8. Wait until the entry `VISIBLE_ENTRY_ID` has at least 3 tracked events (accounting for the final
   event from cycle 1 and at least the initial event of the new cycle), using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
9. Read the current `viewId` for `VISIBLE_ENTRY_ID` and store it as `postForegroundViewId` — see
   [getViewId](./helpers-pseudocode.md#getviewid).
10. Assert that `postForegroundViewId` does not equal `preBackgroundViewId`.

### "should reset accumulated duration for a new visibility cycle"

**Verifies:** When a new visibility cycle begins, the entry's `viewDurationMs` resets and does not
carry over the duration accumulated in the previous cycle.

**Steps:**

1. Wait until the element with text "Analytics Events" is visible, using
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the entry `VISIBLE_ENTRY_ID` has at least 2 tracked events, using `EXTENDED_TIMEOUT` —
   see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
3. Read the current `viewDurationMs` for `VISIBLE_ENTRY_ID` and store it as `firstCycleDuration` —
   see [getViewDuration](./helpers-pseudocode.md#getviewduration).
4. Assert that `firstCycleDuration` is greater than 4000 ms.
5. Scroll the element with test ID `main-scroll-view` downward by 1500 units to end the cycle and
   trigger a final event.
6. Sleep for 1000 ms — see [sleep](./helpers-pseudocode.md#sleep).
7. Scroll the element with test ID `main-scroll-view` back to its top so the entry becomes visible
   again and a new cycle starts.
8. Sleep for 500 ms — see [sleep](./helpers-pseudocode.md#sleep).
9. Wait until the entry `VISIBLE_ENTRY_ID` has at least 4 tracked events (cycle 1 produced initial +
   periodic + final = 3 events; the new cycle's initial event is event 4), using `EXTENDED_TIMEOUT`
   — see [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
10. Read the current `viewDurationMs` for `VISIBLE_ENTRY_ID` and store it as `secondCycleDuration` —
    see [getViewDuration](./helpers-pseudocode.md#getviewduration).
11. Assert that `secondCycleDuration` is greater than or equal to 2000 ms.
12. Assert that `secondCycleDuration` is less than 4000 ms.
