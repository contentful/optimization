# analytics.test.js — Insights API Events

## Goal

This test file verifies that the SDK's analytics layer automatically emits entry view events through
the Insights API event stream when entries become visible in the UI. It exercises the periodic
tracking pipeline that observes rendered entries and queues view events, ensuring the SDK reliably
reports impressions for personalized content. This matters because downstream analytics,
experimentation, and audience-building features depend on accurate, timely entry view tracking.

## Test setup

- **beforeAll**: Launch the application under test with default launch arguments.
- **beforeEach**: Reset profile state — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).

## Tests

### "should track entry view events for visible entries"

**Verifies:** When the Analytics Events screen is open, the SDK emits at least one Insights API
event and a per-entry stats element for the tracked merge tag entry becomes visible after scrolling.

**Steps:**

1. Wait until the element with visible text `Analytics Events` becomes visible, using the default
   element visibility timeout — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until the recorded Insights API event count is at least `1` — see
   [waitForEventsCountAtLeast](./helpers-pseudocode.md#waitforeventscountatleast).
3. Scroll the element with test ID `main-scroll-view` downward by `500` units, repeatedly, until the
   element with test ID `entry-stats-1MwiFl4z7gkwqGYdvCmr8c` becomes visible. This per-entry stats
   summary element confirms that the merge tag entry was tracked under periodic tracking.
