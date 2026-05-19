const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

// Drives the unidentified -> identified round-trip the baseline tests rely on.
// The home-screen OptimizedEntry instances lock on their first resolved value,
// so a mid-test identify does not re-resolve them; only a relaunch makes the
// SDK re-run audience evaluation against the now-identified profile. That
// relaunch is exactly what turns a "baseline rendered" assertion from a
// no-op-tolerant check into proof the SDK genuinely evaluated the audience.
async function identifyAndRelaunch() {
  await waitFor(element(by.id('identify-button')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  await element(by.id('identify-button')).tap()
  await waitFor(element(by.id('reset-button')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  await device.terminateApp()
  await device.launchApp({ newInstance: true })
}

describe('unidentified user', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  // Relaunch with cleared storage before every test. The baseline tests below
  // identify and leave the app in an identified state, so a plain in-app reset
  // would not restore the locked unidentified variant resolution. A fresh
  // instance guarantees every test starts from a true unidentified profile.
  beforeEach(async () => {
    await clearProfileState({ requireFreshAppInstance: true })
  })

  describe('common variants', () => {
    it('should display merge tag content with resolved value', async () => {
      // Wait for the entry text to appear
      await waitFor(element(by.id('entry-text-1MwiFl4z7gkwqGYdvCmr8c')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // Verify the element contains the merge tag text - check for key parts
      await expect(
        element(
          by.label(
            'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant for visitors from Europe', async () => {
      // Wait for the entry text to appear
      await waitFor(element(by.id('entry-text-4ib0hsHWoSOnCVdDkizE8d')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // Check for the variant text
      await expect(
        element(
          by.label(
            'This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant for desktop browser visitors', async () => {
      // Wait for the entry text to appear
      await waitFor(element(by.id('entry-text-xFwgG3oNaOcjzWiGe4vXo')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // Check for the variant text
      await expect(
        element(
          by.label(
            'This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]',
          ),
        ),
      ).toBeVisible()
    })
  })

  describe('unidentified user variants', () => {
    it('should display variant for new visitors', async () => {
      await waitFor(element(by.id('entry-text-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a variant content entry for new visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant B for A/B/C experiment', async () => {
      await waitFor(element(by.id('entry-text-5XHssysWUDECHzKLzoIsg1')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display baseline for visitors with or without custom event', async () => {
      // Unidentified visitor: the custom-event audience is unmatched, so the
      // SDK must resolve this entry to its baseline rich-text body.
      await waitFor(element(by.id('entry-text-6zqoWXyiSrf0ja7I2WGtYj')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]',
          ),
        ),
      ).toBeVisible()

      // The baseline label alone is satisfied even by a no-op SDK: the render
      // pipeline falls through to the untouched entry whenever no variant is
      // selected, so "baseline rendered" and "SDK did nothing" are
      // indistinguishable. Identifying must flip the SAME entry to its
      // custom-event variant, whose body text exists only in the variant and
      // is unreachable without real audience evaluation. Observing the swap
      // retroactively proves the unidentified baseline was a genuine SDK
      // decision rather than a pipeline artifact.
      await identifyAndRelaunch()

      await expect(
        element(
          by.label(
            'This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]',
          ),
        ),
      ).toBeVisible()

      // The baseline copy must be gone — the SDK replaced the rendered body.
      await expect(
        element(
          by.label(
            'This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]',
          ),
        ),
      ).not.toExist()
    })

    it('should display baseline for all identified or unidentified users', async () => {
      // Unidentified visitor: this "all users" experience has no qualifying
      // variant for an anonymous profile, so it must render baseline.
      await waitFor(element(by.id('entry-text-7pa5bOx8Z9NmNcr7mISvD')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]',
          ),
        ),
      ).toBeVisible()

      // "All users" is the most failure-open audience shape: a no-op SDK
      // satisfies the baseline assertion above purely by accident. Identifying
      // must flip this entry to its identified-users variant, whose body text
      // never appears in the baseline. The swap is the evidence that the
      // unidentified baseline was an evaluated outcome, not a fall-through.
      await identifyAndRelaunch()

      await expect(
        element(
          by.label(
            'This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]',
          ),
        ),
      ).toBeVisible()

      await expect(
        element(
          by.label(
            'This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]',
          ),
        ),
      ).not.toExist()
    })
  })

  describe('nested optimization baselines', () => {
    it('should display level 0 nested baseline for new visitors', async () => {
      // New (unidentified) visitor: the level-0 nested experience is unmatched,
      // so NestedContentItem keys its testID and label off the baseline entry.
      await waitFor(element(by.id('entry-text-1JAU028vQ7v6nB2swl3NBo')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]'),
        ),
      ).toBeVisible()

      // The nested testID is keyed off resolvedEntry.sys.id, so the variant id
      // 2KIW... can only enter the tree if the SDK actually selects the level-0
      // variant. A no-op SDK leaves the baseline id in place forever.
      // Identifying must surface 2KIW... and retire 1JAU..., proving the
      // unidentified baseline render was a real resolution decision rather than
      // the entry passing through untouched.
      await identifyAndRelaunch()

      await waitFor(element(by.id('entry-text-2KIWllNZJT205BwOSkMINg')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(element(by.id('entry-text-1JAU028vQ7v6nB2swl3NBo'))).not.toExist()
    })

    it('should display level 1 nested baseline for new visitors', async () => {
      // New (unidentified) visitor: the level-1 nested experience is unmatched,
      // so the resolved-entry-keyed testID is the baseline id.
      await waitFor(element(by.id('entry-text-5i4SdJXw9oDEY0vgO7CwF4')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]'),
        ),
      ).toBeVisible()

      // Identifying must re-resolve the level-1 experience to its variant
      // (5a8...), an id the host app never fetches directly — it only enters
      // the tree when the SDK selects it. The baseline id must disappear,
      // confirming the unidentified baseline was an evaluated outcome.
      await identifyAndRelaunch()

      await waitFor(element(by.id('entry-text-5a8ONfBdanJtlJ39WWnH1w')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(element(by.id('entry-text-5i4SdJXw9oDEY0vgO7CwF4'))).not.toExist()
    })

    it('should display level 2 nested baseline for new visitors', async () => {
      // New (unidentified) visitor: the deepest nested experience is unmatched,
      // so the resolved-entry-keyed testID is the baseline id.
      await waitFor(element(by.id('entry-text-uaNY4YJ0HFPAX3gKXiRdX')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 2 nested baseline entry. [Entry: uaNY4YJ0HFPAX3gKXiRdX]'),
        ),
      ).toBeVisible()

      // Identifying must re-resolve the level-2 experience to its variant
      // (4hDi...). Its appearance, paired with the baseline id disappearing,
      // proves the SDK descends and evaluates audiences at every nesting depth
      // rather than leaving deep entries untouched.
      await identifyAndRelaunch()

      await waitFor(element(by.id('entry-text-4hDiXxYEFrXHXcQgmdL9Uv')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(element(by.id('entry-text-uaNY4YJ0HFPAX3gKXiRdX'))).not.toExist()
    })
  })
})
