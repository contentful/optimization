# offline-behavior.test.js — Offline behavior

## Goal

Verify that the SDK remains resilient under offline conditions: event tracking continues while the
device has no network, the app does not crash during connectivity loss or rapid network toggles, and
queued events flush once connectivity is restored. Identified profile state and cached UI must
survive a reconnect so that the app remains fully functional after the network returns.

## Test setup

- **beforeAll**: Launch the application fresh.
- **beforeEach**: Clear profile state — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate). Then ensure the device starts each
  test with network connectivity — see
  [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
- **afterEach**: Always restore network connectivity so subsequent tests are not affected — see
  [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).

Local helpers used in this file:

- `pause(ms)`: wait for the given number of milliseconds.
- `parseEventsCount(text)`: extract the integer captured by the regex `/Events:\s*(\d+)/` from a
  text string, returning `0` if there is no match.
- `getEventsCount()`: read the text of the element with test ID `events-count` (see
  [getElementTextById](./helpers-pseudocode.md#getelementtextbyid)) and run it through
  `parseEventsCount`.

## Tests

### "should continue to track events while offline"

**Verifies:** While the device is offline, tapping the identify button still causes the in-app
analytics events counter to increment, proving local event tracking continues without network.

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

### "should recover gracefully when network is restored"

**Verifies:** After toggling the device offline and then back online, the app remains visible and
interactive, with no crash and no loss of core UI.

**Steps:**

1. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Set the device to offline state — see
   [disableNetwork](./networkHelpers-pseudocode.md#disablenetwork).
3. Wait `1000` ms to let the offline state stabilize before reconnecting.
4. Restore network connectivity — see [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
5. Assert that the element with the exact text `Analytics Events` is still visible.
6. Wait until the element with test ID `identify-button` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.

### "should handle rapid network state changes"

**Verifies:** Rapid back-to-back offline/online toggles do not destabilize or crash the app; core UI
remains visible and interactive afterward.

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
9. Wait until the element with the exact text `Analytics Events` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`.
10. Wait until the element with test ID `identify-button` is visible, using a timeout of
    `ELEMENT_VISIBILITY_TIMEOUT`.

### "should queue events offline and eventually flush when online"

**Verifies:** Events generated while offline are tracked locally; after reconnect the app remains
functional and preserves the identified profile state (indicated by the `reset-button` becoming
visible).

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
7. Restore network connectivity so queued events can flush — see
   [enableNetwork](./networkHelpers-pseudocode.md#enablenetwork).
8. Wait until the element with test ID `reset-button` is visible, using a timeout of
   `ELEMENT_VISIBILITY_TIMEOUT`, confirming the app remains functional and the identified state is
   preserved after reconnect.
