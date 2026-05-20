# offline-behavior.test.js — Offline behavior

## Goal

Verify that the SDK remains resilient under offline conditions: event tracking continues while the
device has no network, and identify events generated offline (or after connectivity loss and rapid
network toggles) are genuinely queued and flushed once connectivity is restored. Each test proves
the recovery by relaunching and asserting that the SDK resolves the identified-only nested variant
entry rather than the anonymous baseline, so a no-op SDK cannot pass.

## Test setup

- **beforeAll**: Launch the application fresh.
- **beforeEach**: First restore network connectivity so the device starts each test online — see
  [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork). Then clear profile state with
  `requireFreshAppInstance` set to `true`, forcing a relaunch from clean storage so the next test
  starts from a true anonymous profile — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).
- **afterEach**: Always restore network connectivity so subsequent tests are not affected — see
  [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).

Constants used in this file:

- `QUEUE_FLUSH_GRACE_MS` = `10000` — time allowed after reconnecting for the SDK online signal to
  flip and the resulting Experience API queue flush to land before the app is terminated.
- `IDENTIFY_SETTLE_MS` = `3000` — time allowed after an online identify for the Experience upsert
  round-trip to complete before the app is terminated.
- `POST_RELAUNCH_TIMEOUT` = `30000` — timeout for the post-relaunch variant assertions, generous
  enough for a cold start to boot, fetch entries, and run resolution.
- `NESTED_VARIANT_TEST_ID` = `entry-text-2KIWllNZJT205BwOSkMINg` — nested level-0 entry id that only
  appears once the SDK resolves the identified profile.
- `NESTED_BASELINE_TEST_ID` = `entry-text-1JAU028vQ7v6nB2swl3NBo` — nested level-0 entry id that
  only appears for an anonymous profile.

Local helpers used in this file:

- `pause(ms)`: wait for the given number of milliseconds.
- `parseEventsCount(text)`: extract the integer captured by the regex `/Events:\s*(\d+)/` from a
  text string, returning `0` if there is no match.
- `getEventsCount()`: read the text of the element with test ID `events-count` (see
  [getElementTextById](./helpers-pseudocode.md#getelementtextbyid)) and run it through
  `parseEventsCount`.

## Tests

### "should continue to track events while offline"

**Verifies:** While the device is offline, tapping the identify button still increments the in-app
analytics events counter, and the offline identify is genuinely queued — once connectivity is
restored the flushed identify is delivered so a relaunched app resolves the identified-only nested
variant rather than the anonymous baseline.

**Steps:**

1. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Wait until at least 1 event has been tracked — see
   [waitForEventsCountAtLeast](./helpers-pseudocode.md#waitforeventscountatleast).
3. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
4. Capture the current events count from the element with test ID `events-count` as
   `eventsBeforeIdentify` using the local `getEventsCount()` helper.
5. Tap the element with test ID `identify-button`.
6. Wait until the element with test ID `events-count` has text whose parsed events count is greater
   than or equal to `eventsBeforeIdentify + 1`, with a timeout of `ELEMENT_VISIBILITY_TIMEOUT` — see
   [waitForElementTextById](./helpers-pseudocode.md#waitforelementtextbyid).
7. Restore network connectivity so the Experience queue flushes — see
   [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
8. Wait `QUEUE_FLUSH_GRACE_MS` ms to let the queue flush round-trip land.
9. Terminate the app and relaunch it as a new instance.
10. Wait until the element with test ID `NESTED_VARIANT_TEST_ID` exists, using a timeout of
    `POST_RELAUNCH_TIMEOUT`.
11. Assert that the element with test ID `NESTED_BASELINE_TEST_ID` does not exist.

### "should recover gracefully when network is restored"

**Verifies:** After an offline/online transition, the SDK can still complete an end-to-end identify
pipeline — identify, Experience upsert, variant resolution — so a relaunched app resolves the
identified-only nested variant rather than the anonymous baseline.

**Steps:**

1. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
3. Wait `1000` ms to let the offline state stabilize before reconnecting.
4. Restore network connectivity — see [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
5. Wait `IDENTIFY_SETTLE_MS` ms to let the connectivity transition settle before identifying online.
6. Tap the element with test ID `identify-button`.
7. Wait until the element with test ID `reset-button` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
8. Wait `IDENTIFY_SETTLE_MS` ms to let the Experience upsert round-trip land.
9. Terminate the app and relaunch it as a new instance.
10. Wait until the element with test ID `NESTED_VARIANT_TEST_ID` exists, using a timeout of
    `POST_RELAUNCH_TIMEOUT`.
11. Assert that the element with test ID `NESTED_BASELINE_TEST_ID` does not exist.

### "should handle rapid network state changes"

**Verifies:** After a burst of rapid offline/online toggles ending online, the SDK is still fully
operational — a complete identify pipeline must still resolve the identified-only nested variant
after relaunch rather than leaving the SDK wedged on the anonymous baseline.

**Steps:**

1. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
3. Wait `500` ms.
4. Restore network connectivity — see [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
5. Wait `500` ms.
6. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
7. Wait `500` ms.
8. Restore network connectivity — see [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
9. Wait `IDENTIFY_SETTLE_MS` ms to let the connectivity churn settle before identifying.
10. Tap the element with test ID `identify-button`.
11. Wait until the element with test ID `reset-button` is visible, using a timeout of
    `ELEMENT_VISIBILITY_TIMEOUT`.
12. Wait `IDENTIFY_SETTLE_MS` ms to let the Experience upsert round-trip land.
13. Terminate the app and relaunch it as a new instance.
14. Wait until the element with test ID `NESTED_VARIANT_TEST_ID` exists, using a timeout of
    `POST_RELAUNCH_TIMEOUT`.
15. Assert that the element with test ID `NESTED_BASELINE_TEST_ID` does not exist.

### "should queue events offline and eventually flush when online"

**Verifies:** Events generated while offline are tracked locally; after reconnect the queued
identify flushes to the Experience API end to end, so a relaunched app resolves the identified-only
nested variant and shows the `reset-button` (which renders only for a rehydrated identified
profile).

**Steps:**

1. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Wait until at least 1 event has been tracked — see
   [waitForEventsCountAtLeast](./helpers-pseudocode.md#waitforeventscountatleast).
3. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
4. Capture the current events count from the element with test ID `events-count` as
   `eventsBeforeIdentify` using the local `getEventsCount()` helper.
5. Tap the element with test ID `identify-button`.
6. Wait until the element with test ID `events-count` has text whose parsed events count is greater
   than or equal to `eventsBeforeIdentify + 1`, with a timeout of `ELEMENT_VISIBILITY_TIMEOUT` — see
   [waitForElementTextById](./helpers-pseudocode.md#waitforelementtextbyid).
7. Restore network connectivity so the offline Experience queue flushes — see
   [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
8. Wait `QUEUE_FLUSH_GRACE_MS` ms to let the flush round-trip reach the server.
9. Terminate the app and relaunch it as a new instance.
10. Wait until the element with test ID `NESTED_VARIANT_TEST_ID` exists, using a timeout of
    `POST_RELAUNCH_TIMEOUT`.
11. Assert that the element with test ID `NESTED_BASELINE_TEST_ID` does not exist.
12. Wait until the element with test ID `reset-button` is visible, using a timeout of
    `POST_RELAUNCH_TIMEOUT`, confirming the identified profile state was preserved across the cold
    start.
