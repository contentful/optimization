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
- **beforeEach**: Reset profile state — see
  [clearProfileState](./helpers-pseudocode.md#clearprofilestate).

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
content when no custom event has been emitted.

**Steps:**

1. Wait until the element with test ID `entry-text-6zqoWXyiSrf0ja7I2WGtYj` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]`
   is visible.

#### "should display baseline for all identified or unidentified users"

**Verifies:** An entry whose audience matches all users renders its baseline content for an
unidentified visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-7pa5bOx8Z9NmNcr7mISvD` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]`
   is visible.

### Group: "nested optimization baselines"

#### "should display level 0 nested baseline for new visitors"

**Verifies:** The outermost (level 0) entry of a nested optimization tree renders its baseline
content for an unidentified new visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-1JAU028vQ7v6nB2swl3NBo` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]` is visible.

#### "should display level 1 nested baseline for new visitors"

**Verifies:** The level 1 entry of the nested optimization tree renders its baseline content for an
unidentified new visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-5i4SdJXw9oDEY0vgO7CwF4` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]` is visible.

#### "should display level 2 nested baseline for new visitors"

**Verifies:** The innermost (level 2) entry of the nested optimization tree renders its baseline
content for an unidentified new visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-uaNY4YJ0HFPAX3gKXiRdX` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT` — see
   [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
2. Assert that an element with accessibility label
   `This is a level 2 nested baseline entry. [Entry: uaNY4YJ0HFPAX3gKXiRdX]` is visible.
