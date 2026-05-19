# Helpers pseudocode reference

# Overview

This document describes the shared E2E helper utilities that back the React Native preview-panel and
tracking test suites, expressed in platform-agnostic terms so iOS-native, Android-native, web, and
other SDK implementations can verify identical behavior. The helpers cover four concerns: (1) state
reset between tests via in-app controls or a clean app relaunch, (2) polling-based waits for element
visibility and text content, (3) regex-driven extraction of event counts, view durations, and view
IDs from on-screen labels, and (4) interaction with native alert dialogs. Each helper standardizes
timeouts and failure handling so the same scenarios reach the same checkpoints in the same order on
every platform.

## ELEMENT_VISIBILITY_TIMEOUT

**Purpose:** Default maximum duration in milliseconds that visibility and text-content waits will
poll before failing.

**Value:** 5000 ms when running in CI, 10000 ms otherwise. Selection is based on a CI environment
indicator at process startup.

**Usage:** All waits that do not pass an explicit timeout default to this constant. It is also
re-exported so test files can reuse the same budget for their own waits.

## sleep(timeout)

**Purpose:** Yield for a fixed duration to space out polling or let async UI work settle.

**Inputs:** `timeout` — duration in milliseconds.

**Returns / throws:** Resolves after the duration elapses. Never throws.

**Steps:**

1. Return a promise that resolves after `timeout` milliseconds.

## isVisibleById(testId, timeout = 750)

**Purpose:** Non-throwing probe that reports whether an element with the given test ID is currently
visible.

**Inputs:**

- `testId` — accessibility/test identifier of the element to probe.
- `timeout` — milliseconds to wait for visibility before reporting absence. Default 750 ms.

**Returns / throws:** Returns `true` if the element becomes visible within `timeout`, otherwise
`false`. Never throws; any underlying error is swallowed and converted to `false`.

**Steps:**

1. Wait until the element with test ID `testId` is visible, up to `timeout` ms.
2. If the wait succeeds, return `true`.
3. If the wait fails or throws for any reason, return `false`.

## tapIfVisibleById(testId, timeout = 750)

**Purpose:** Tap an element only if it is currently visible, used to dismiss optional modals or
overlays without failing when they are absent.

**Inputs:**

- `testId` — accessibility/test identifier of the element to tap.
- `timeout` — milliseconds to wait for visibility before giving up. Default 750 ms.

**Returns / throws:** Returns `true` if the element was visible and was tapped; `false` if it was
not visible within `timeout`. Does not throw on absence.

**Steps:**

1. Call [isVisibleById](#isvisiblebyid) with `testId` and `timeout`.
2. If it returned `false`, return `false` and do not tap.
3. Otherwise tap the element with test ID `testId` and return `true`.

## getElementTextById(testId)

**Purpose:** Read the displayed text of an element, falling back to its accessibility label when
text is empty.

**Inputs:** `testId` — accessibility/test identifier of the element to read.

**Returns / throws:** A string containing the element's text, or its accessibility label if text is
empty/missing, or an empty string if both are absent. Propagates errors raised while reading the
element's attributes.

**Steps:**

1. Fetch the element's attributes (text and accessibility label).
2. Return `attributes.text` if present and truthy.
3. Otherwise return `attributes.label` if present and truthy.
4. Otherwise return the empty string `''`.

## waitForElementTextById(testId, predicate, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Poll the displayed text of an element until a caller-supplied predicate returns true,
or fail with the last observed text in the error message.

**Inputs:**

- `testId` — accessibility/test identifier of the element to observe.
- `predicate` — function taking the current text string and returning a boolean indicating whether
  the wait is satisfied.
- `timeout` — total polling budget in milliseconds. Defaults to
  [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Returns the first observed text for which `predicate(text)` is true. Throws an
`Error` with message `Timed out waiting for text condition on "<testId>". Last text: "<lastText>"`
if the predicate never becomes true within `timeout`.

**Steps:**

1. Compute `deadline = now + timeout` and initialize `lastText` to the empty string.
2. While `now < deadline`:
   1. Wait up to 500 ms for the element with test ID `testId` to be visible. If that wait fails,
      swallow the error and continue to step 2.4.
   2. Read the element's current text via [getElementTextById](#getelementtextbyid) and assign it to
      `lastText`.
   3. If `predicate(currentText)` returns true, return `currentText` immediately.
   4. Sleep 150 ms via [sleep](#sleep), then loop.
3. After the deadline passes without a satisfying text, throw the timeout error described above,
   embedding the most recent observed text.

## waitForTextEqualsById(testId, expectedText, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Wait until an element's displayed text exactly equals a given string.

**Inputs:**

- `testId` — element test ID.
- `expectedText` — string that must match exactly (strict equality, no trimming).
- `timeout` — polling budget. Defaults to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Returns the observed text once it equals `expectedText`. Throws the timeout
error from [waitForElementTextById](#waitforelementtextbyid) if it never matches.

**Steps:**

1. Delegate to [waitForElementTextById](#waitforelementtextbyid) with a predicate
   `text === expectedText` and the supplied `timeout`.

## waitForTextChangeById(testId, baselineText, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Wait until an element's displayed text differs from a previously captured baseline,
used to detect that an asynchronous update has propagated.

**Inputs:**

- `testId` — element test ID.
- `baselineText` — the prior text snapshot to compare against.
- `timeout` — polling budget. Defaults to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Returns the first observed text that is not strictly equal to `baselineText`.
Throws the timeout error from [waitForElementTextById](#waitforelementtextbyid) if the text never
changes.

**Steps:**

1. Delegate to [waitForElementTextById](#waitforelementtextbyid) with a predicate
   `text !== baselineText` and the supplied `timeout`.

## waitForEventsCountAtLeast(minCount, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Wait until the global events counter label reports at least `minCount` events.

**Inputs:**

- `minCount` — minimum integer event count to satisfy the wait.
- `timeout` — polling budget. Defaults to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Resolves once satisfied. Throws the timeout error from
[waitForElementTextById](#waitforelementtextbyid) if the threshold is not reached.

**Steps:**

1. Call [waitForElementTextById](#waitforelementtextbyid) against test ID `events-count` with the
   timeout.
2. The predicate parses the element text against the regex:
   ```
   /Events:\s*(\d+)/
   ```
3. If the regex does not match or has no captured group, the predicate returns false.
4. Otherwise it returns true when the captured integer is `>= minCount`.

## relaunchCleanApp()

**Purpose:** Perform a hard reset of the app: terminate the running process and relaunch it with all
on-device storage cleared, then wait until the home screen's primary action is visible.

**Inputs:** None.

**Returns / throws:** Resolves once the post-relaunch landmark is visible. Propagates any error from
terminate, launch, or the final visibility wait.

**Steps:**

1. Terminate the running app process.
2. Relaunch the app with a flag/option that deletes persisted app data (clears profile, storage,
   caches).
3. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout) for the element with test ID
   `identify-button` to be visible. If it does not appear in time, propagate the error.

## clearProfileState(options = {})

**Purpose:** Reset profile state between tests using the cheapest viable path: dismiss any open
panels, prefer an in-app reset, and only fall back to a hard relaunch when the in-app state is
unrecoverable or the caller explicitly requires a fresh app instance.

**Inputs:**

- `options.requireFreshAppInstance` — boolean, default `false`. When `true`, always perform a clean
  relaunch via [relaunchCleanApp](#relaunchcleanapp) and skip the fast path entirely.

**Returns / throws:** Resolves once the app is in a known-good post-reset state with the
`identify-button` visible. Errors raised during the fast path are swallowed and a fallback relaunch
is performed; errors from the fallback itself propagate.

**Steps:**

1. Enter a try block guarding the fast path:
   1. Call [tapIfVisibleById](#tapifvisiblebyid) for test ID `close-live-updates-test-button`
      (default 750 ms visibility probe). This dismisses any open live-updates test panel if present.
   2. Call [tapIfVisibleById](#tapifvisiblebyid) for test ID `close-navigation-test-button` (default
      750 ms). This dismisses any open navigation test panel if present.
   3. If `requireFreshAppInstance` is `true`, call [relaunchCleanApp](#relaunchcleanapp) and return
      immediately, skipping the remaining fast-path checks.
   4. Attempt the in-app fast reset: call [tapIfVisibleById](#tapifvisiblebyid) for test ID
      `reset-button` with a 1500 ms visibility probe. If it returned `true` (the reset button was
      found and tapped):
      1. Wait up to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout) for test ID
         `identify-button` to be visible, then return.
   5. Otherwise, probe for test ID `identify-button` with [isVisibleById](#isvisiblebyid) at 1500
      ms. If it is already visible, the app is already at the post-reset landing state, so return
      without further action.
2. If any error is thrown inside the try block, swallow it and continue to the fallback.
3. Fallback: call [relaunchCleanApp](#relaunchcleanapp). Errors from the fallback are not caught.

**Order and conditions summary:**

- Test IDs tapped during fast path, in order: `close-live-updates-test-button`,
  `close-navigation-test-button`, then optionally `reset-button`.
- Fallback fires when: an exception escapes the fast path, OR the fast path completes without
  finding either `reset-button` or an already-visible `identify-button`.
- The `requireFreshAppInstance` branch bypasses the `reset-button` and `identify-button` fast-path
  checks but still performs the two panel-dismiss taps first.

## waitForTrackedItemEventCount(componentId, minCount, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Wait until the per-component event-count label for `componentId` reports at least
`minCount` events, scrolling the stats list into view first if needed.

**Inputs:**

- `componentId` — identifier suffix for the component whose count label is being watched. The
  resolved test ID is `event-count-<componentId>`.
- `minCount` — minimum integer count required.
- `timeout` — polling budget. Defaults to [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Resolves once satisfied. Throws the timeout error from
[waitForElementTextById](#waitforelementtextbyid) if the count threshold is not reached.

**Steps:**

1. Compute `testId = "event-count-" + componentId`.
2. Attempt to scroll the scrollable container with test ID `main-scroll-view` to its top. Swallow
   any error (the view may not be scrollable).
3. Attempt to scroll the target element into visibility by scrolling `main-scroll-view` downward in
   300-unit increments until the element with `testId` becomes visible. Swallow any error (the
   element may already be visible, or scrolling may not be required).
4. Call [waitForElementTextById](#waitforelementtextbyid) with `testId` and the timeout. The
   predicate parses the element text against the regex:
   ```
   /Count:\s*(\d+)/
   ```
5. If the regex does not match or lacks a captured group, the predicate returns false. Otherwise it
   returns true when the captured integer is `>= minCount`.

## getViewDuration(componentId)

**Purpose:** Read and parse the view-duration label for a tracked component into a numeric
millisecond value.

**Inputs:** `componentId` — identifier suffix. The resolved test ID is
`event-duration-<componentId>`.

**Returns / throws:** Returns the parsed integer duration if the label matches the expected pattern;
otherwise returns `null`. Propagates errors from reading the element's text.

**Steps:**

1. Compute `testId = "event-duration-" + componentId`.
2. Read the element text via [getElementTextById](#getelementtextbyid).
3. Match the text against the regex:
   ```
   /Duration:\s*(\d+)/
   ```
4. If a captured group is present, convert it to a number and return it.
5. Otherwise return `null`.

## getViewId(componentId)

**Purpose:** Read and parse the view-ID label for a tracked component, treating `N/A` as absent.

**Inputs:** `componentId` — identifier suffix. The resolved test ID is
`event-view-id-<componentId>`.

**Returns / throws:** Returns the trimmed view-ID string, or `null` if the label is missing, does
not match the pattern, or equals `N/A`. Propagates errors from reading the element's text.

**Steps:**

1. Compute `testId = "event-view-id-" + componentId`.
2. Read the element text via [getElementTextById](#getelementtextbyid).
3. Match the text against the regex:
   ```
   /ViewId:\s*(.+)/
   ```
4. If there is no captured group, or the captured group equals the literal string `N/A`, return
   `null`.
5. Otherwise return the captured group with leading and trailing whitespace removed.

## tapAlertButton(label, timeout = ELEMENT_VISIBILITY_TIMEOUT)

**Purpose:** Wait for and tap a button in the native alert dialog by its visible label,
disambiguating against duplicate matchers elsewhere on screen.

**Inputs:**

- `label` — the exact visible text of the alert button.
- `timeout` — milliseconds to wait for the button to appear. Defaults to
  [ELEMENT_VISIBILITY_TIMEOUT](#element_visibility_timeout).

**Returns / throws:** Resolves once the button has been tapped. Propagates errors from the
visibility wait or the tap (e.g., if the label never appears within `timeout`).

**Steps:**

1. Wait up to `timeout` ms for the first element matching the visible text `label` (index 0 among
   same-label matches) to become visible. The index-0 selection guards against multiple elements
   sharing the same text elsewhere in the UI.
2. Tap that first matching element.

**Platform note:** This targets the native alert primitive on each platform (e.g., `AlertDialog` on
Android, `UIAlertController` on iOS, or the equivalent native dialog elsewhere), whose buttons are
exposed as text-matchable elements.
