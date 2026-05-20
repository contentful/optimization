# displays-unidentified-user-variants.test.js — unidentified user

## Goal

This test file verifies that, for an unidentified (anonymous) visitor with no persisted profile
state, the SDK resolves and renders the expected variant (or baseline) content for each optimization
entry on the home screen. It covers merge-tag resolution, audience-based variants for common visitor
signals (continent, device), unidentified-user-specific variants and baselines, and
nested-optimization baselines. Compared to the identified-user variants suite, this file always
starts from a cleared profile so the resolved content reflects the default/unidentified audience
rules rather than user-attribute-driven targeting.

## Test setup

- **beforeAll**: Launch the application under test in its default state.
- **beforeEach**: Reset profile state with `requireFreshAppInstance: true` so each test starts from
  a fresh app instance and a true unidentified profile — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).

## Local helper: identifyAndRelaunch

Drives the unidentified -> identified round-trip the baseline tests rely on. The home-screen
optimized entries lock on their first resolved value, so a mid-test identify does not re-resolve
them; only a relaunch makes the SDK re-run audience evaluation against the now-identified profile.

**Steps:**

1. Wait until the element with test ID `identify-button` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Tap the element with test ID `identify-button`.
3. Wait until the element with test ID `reset-button` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
4. Terminate the application.
5. Relaunch the application as a new instance.

## Tests

### Group: "common variants"

#### "should display merge tag content with resolved value"

**Verifies:** A merge-tag content entry resolves the visitor's continent placeholder to "EU" and
renders the resolved text.

**Steps:**

1. Wait until the element with test ID `entry-text-1MwiFl4z7gkwqGYdvCmr8c` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]`
   is visible.

#### "should display variant for visitors from Europe"

**Verifies:** A continent-targeted variant entry renders the Europe variant for an unidentified
visitor whose inferred continent is Europe.

**Steps:**

1. Wait until the element with test ID `entry-text-4ib0hsHWoSOnCVdDkizE8d` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]` is
   visible.

#### "should display variant for desktop browser visitors"

**Verifies:** A device-targeted variant entry renders the desktop-browser variant for an
unidentified desktop visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-xFwgG3oNaOcjzWiGe4vXo` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]`
   is visible.

### Group: "unidentified user variants"

#### "should display variant for new visitors"

**Verifies:** An entry targeted to new visitors renders its new-visitor variant when no profile
state is present.

**Steps:**

1. Wait until the element with test ID `entry-text-2Z2WLOx07InSewC3LUB3eX` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a variant content entry for new visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]` is visible.

#### "should display variant B for A/B/C experiment"

**Verifies:** An A/B/C experiment entry resolves to variant B for an unidentified visitor (the
deterministic bucket assignment for the cleared-profile state).

**Steps:**

1. Wait until the element with test ID `entry-text-5XHssysWUDECHzKLzoIsg1` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]` is
   visible.

#### "should display baseline for visitors with or without custom event"

**Verifies:** An entry whose audience is defined by an optional custom event renders its baseline
content when no custom event has been emitted, and identifying flips the same entry to its
custom-event variant — proving the unidentified baseline was a genuine SDK decision rather than a
pipeline fall-through.

**Steps:**

1. Wait until the element with test ID `entry-text-6zqoWXyiSrf0ja7I2WGtYj` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]`
   is visible.
3. Identify and relaunch — see [identifyAndRelaunch](#local-helper-identifyandrelaunch).
4. Assert that an element with accessibility label
   `This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]`
   is visible.
5. Assert that an element with accessibility label
   `This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]`
   does not exist.

#### "should display baseline for all identified or unidentified users"

**Verifies:** An entry whose audience matches all users renders its baseline content for an
unidentified visitor, and identifying flips the same entry to its identified-users variant — proving
the unidentified baseline was an evaluated outcome rather than a fall-through.

**Steps:**

1. Wait until the element with test ID `entry-text-7pa5bOx8Z9NmNcr7mISvD` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]`
   is visible.
3. Identify and relaunch — see [identifyAndRelaunch](#local-helper-identifyandrelaunch).
4. Assert that an element with accessibility label
   `This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]` is
   visible.
5. Assert that an element with accessibility label
   `This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]`
   does not exist.

### Group: "nested optimization baselines"

#### "should display level 0 nested baseline for new visitors"

**Verifies:** The outermost (level 0) entry of a nested optimization tree renders its baseline
content for an unidentified new visitor, and identifying surfaces the level-0 variant entry while
retiring the baseline entry — proving the unidentified baseline render was a real resolution
decision.

**Steps:**

1. Wait until the element with test ID `entry-text-1JAU028vQ7v6nB2swl3NBo` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]` is visible.
3. Identify and relaunch — see [identifyAndRelaunch](#local-helper-identifyandrelaunch).
4. Wait until the element with test ID `entry-text-2KIWllNZJT205BwOSkMINg` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Assert that the element with test ID `entry-text-1JAU028vQ7v6nB2swl3NBo` does not exist.

#### "should display level 1 nested baseline for new visitors"

**Verifies:** The level 1 entry of the nested optimization tree renders its baseline content for an
unidentified new visitor, and identifying re-resolves the level-1 experience to its variant entry
while the baseline entry disappears.

**Steps:**

1. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]` is visible.
3. Identify and relaunch — see [identifyAndRelaunch](#local-helper-identifyandrelaunch).
4. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Assert that the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` does not exist.

#### "should display level 2 nested baseline for new visitors"

**Verifies:** The innermost (level 2) entry of the nested optimization tree renders its baseline
content for an unidentified new visitor, and identifying re-resolves the level-2 experience to its
variant entry while the baseline entry disappears — proving the SDK descends and evaluates audiences
at every nesting depth.

**Steps:**

1. Wait until the element with test ID `entry-text-uaNY4YJ0HFPAX3gKXiRdX` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 2 nested baseline entry. [Entry: uaNY4YJ0HFPAX3gKXiRdX]` is visible.
3. Identify and relaunch — see [identifyAndRelaunch](#local-helper-identifyandrelaunch).
4. Wait until the element with test ID `entry-text-4hDiXxYEFrXHXcQgmdL9Uv` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
5. Assert that the element with test ID `entry-text-uaNY4YJ0HFPAX3gKXiRdX` does not exist.
