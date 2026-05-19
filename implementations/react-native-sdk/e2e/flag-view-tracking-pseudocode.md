# flag-view-tracking.test.js — Flag View Tracking

## Goal

Verify that when an app subscribes to a flag through the SDK, the SDK emits a view event for that
flag so the value's exposure can be measured downstream. This test confirms the end-to-end pipeline
from a flag subscription on app boot through to the tracked-event surface that the host app and
analytics consumers observe.

## Test setup

- **beforeAll**: Launch the app.
- **beforeEach**: Clear profile state with a fresh app instance — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate) (note that beforeEach passes
  `{ requireFreshAppInstance: true }`).

## Tests

### "should emit flag view events for the subscribed boolean flag"

**Verifies:** subscribing to the `boolean` flag on app launch produces at least one view event for
that flag.

**Steps:**

1. Wait until the element with text `Analytics Events` is visible, with timeout
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until flag `boolean` has at least 1 view event, with timeout
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout) — see
   [waitForTrackedItemEventCount](./helpers-pseudocode.md#waitfortrackeditemeventcount).
