# displays-identified-user-variants.test.js — Identified user

## Goal

This test file verifies that once a visitor has been identified and the app has been relaunched, the
SDK resolves and renders the correct variant for each optimized entry on screen. It exercises a mix
of common variants (merge tag, continent, device), identified-user-only variants (return visitor,
A/B/C experiment bucket, custom-event audience, identified audience), and nested optimization
variants across three levels of depth. This matters because identified-user state must persist
across app restarts and must drive the correct decisioning for every entry it touches.

## Test setup

- **beforeAll**:
  1. Launch the app.
  2. Reset profile state — see [clearProfileState](./helpers-pseudocode.md#clearprofilestate).
  3. Wait until the element with test ID `identify-button` is visible, with timeout
     `ELEMENT_VISIBILITY_TIMEOUT` — see
     [ELEMENT_VISIBILITY_TIMEOUT](./helpers-pseudocode.md#element_visibility_timeout).
  4. Tap the element with test ID `identify-button`.
  5. Wait until the element with test ID `reset-button` is visible, with timeout
     `ELEMENT_VISIBILITY_TIMEOUT`.
  6. Terminate the app.
  7. Relaunch the app as a new instance so the identified state is rehydrated from persistent
     storage.
  8. Wait until the element with test ID `reset-button` is visible, with timeout
     `ELEMENT_VISIBILITY_TIMEOUT`. The relaunched app derives the identify/reset control from the
     rehydrated identified profile, so `reset-button` (not `identify-button`) appears; waiting for
     it confirms the relaunch finished loading and that the identified profile survived the cold
     start.

## Tests

### Group: "common variants"

#### "should display merge tag content with resolved value"

**Verifies:** the merge tag entry resolves and renders the visitor's continent embedded in the body
text.

**Steps:**

1. Wait until the element with test ID `entry-text-1MwiFl4z7gkwqGYdvCmr8c` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]`
   is visible.

#### "should display variant for visitors from Europe"

**Verifies:** the entry targeted at the Europe continent audience renders the Europe variant.

**Steps:**

1. Wait until the element with test ID `entry-text-4ib0hsHWoSOnCVdDkizE8d` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]` is
   visible.

#### "should display variant for desktop browser visitors"

**Verifies:** the entry targeted at desktop-browser visitors renders the desktop variant.

**Steps:**

1. Wait until the element with test ID `entry-text-xFwgG3oNaOcjzWiGe4vXo` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]`
   is visible.

### Group: "identified user variants"

#### "should display variant for return visitors"

**Verifies:** the entry targeted at return-visitor audience renders the return-visitor variant once
the identified state has persisted across the relaunch.

**Steps:**

1. Wait until the element with test ID `entry-text-2Z2WLOx07InSewC3LUB3eX` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for return visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]` is
   visible.

#### "should display variant B for A/B/C experiment"

**Verifies:** the A/B/C experiment entry buckets this identified visitor into variant B.

**Steps:**

1. Wait until the element with test ID `entry-text-5XHssysWUDECHzKLzoIsg1` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]` is
   visible.

#### "should display variant for visitors with custom event"

**Verifies:** the entry targeted at the custom-event audience renders its variant for this
identified visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-6zqoWXyiSrf0ja7I2WGtYj` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]`
   is visible.

#### "should display variant for identified users"

**Verifies:** the entry targeted at the identified-users audience renders its variant for this
identified visitor.

**Steps:**

1. Wait until the element with test ID `entry-text-7pa5bOx8Z9NmNcr7mISvD` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]` is
   visible.

### Group: "nested optimization variants"

#### "should display level 0 nested variant for return visitors"

**Verifies:** the outermost nested optimization entry resolves to its return-visitor variant.

**Steps:**

1. Wait until the element with test ID `entry-text-2KIWllNZJT205BwOSkMINg` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a level 0 nested variant entry. [Entry: 2KIWllNZJT205BwOSkMINg]` is visible.

#### "should display level 1 nested variant for return visitors"

**Verifies:** the second-level nested optimization entry resolves to its return-visitor variant.

**Steps:**

1. Wait until the element with test ID `entry-text-5a8ONfBdanJtlJ39WWnH1w` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a level 1 nested variant entry. [Entry: 5a8ONfBdanJtlJ39WWnH1w]` is visible.

#### "should display level 2 nested variant for return visitors"

**Verifies:** the third-level (deepest) nested optimization entry resolves to its return-visitor
variant.

**Steps:**

1. Wait until the element with test ID `entry-text-4hDiXxYEFrXHXcQgmdL9Uv` is visible, with timeout
   `ELEMENT_VISIBILITY_TIMEOUT`.
2. Assert that an element with accessibility label
   `This is a level 2 nested variant entry. [Entry: 4hDiXxYEFrXHXcQgmdL9Uv]` is visible.
