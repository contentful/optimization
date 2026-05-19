# tap-tracking.test.js — Tap Tracking

## Goal

Verifies that the SDK emits a `component_click` analytics event when the user taps a tracked content
entry. The emitted event must be associated with the specific entry that was tapped, so that
downstream analytics can attribute the interaction to the correct content. Tapping different entries
must produce distinct `component_click` events keyed by each entry's ID.

## Test setup

- **beforeAll**: Launch the application.
- **beforeEach**: Reset profile state — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).

## Tests

### "should emit `component_click` for a tapped content entry"

**Verifies:** Tapping the content entry with ID `1MwiFl4z7gkwqGYdvCmr8c` causes the SDK to emit a
`component_click` event tied to that entry's ID.

**Steps:**

1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with text `Analytics Events` to be visible.
2. Tap the element with test ID `content-entry-1MwiFl4z7gkwqGYdvCmr8c`.
3. Wait until the total tracked-event count reaches at least 1 — see
   [waitForEventsCountAtLeast](./helpers-pseudocode.md#waitforeventscountatleast).
4. Wait for the element with test ID `event-component_click-1MwiFl4z7gkwqGYdvCmr8c` to become
   visible, scrolling the element with test ID `main-scroll-view` downward by 500 as needed to bring
   it into view.

### "should emit `component_click` for a different tapped entry"

**Verifies:** Tapping the content entry with ID `2Z2WLOx07InSewC3LUB3eX` causes the SDK to emit a
`component_click` event tied to that entry's ID, confirming the event is keyed per entry rather than
fixed to one ID.

**Steps:**

1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) ms
   for the element with text `Analytics Events` to be visible.
2. Tap the element with test ID `content-entry-2Z2WLOx07InSewC3LUB3eX`.
3. Wait until the total tracked-event count reaches at least 1 — see
   [waitForEventsCountAtLeast](./helpers-pseudocode.md#waitforeventscountatleast).
4. Wait for the element with test ID `event-component_click-2Z2WLOx07InSewC3LUB3eX` to become
   visible, scrolling the element with test ID `main-scroll-view` downward by 500 as needed to bring
   it into view.
