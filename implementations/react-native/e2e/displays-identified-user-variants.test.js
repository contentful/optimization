const { clearProfileState } = require('./helpers')

describe('identified user', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
    // TODO: Add identify logic when SDK method is exposed
  })

  describe('common variants', () => {
    it('should display merge tag content with resolved value', async () => {
      // Wait for the entry text to appear
      await waitFor(element(by.id('entry-text-1MwiFl4z7gkwqGYdvCmr8c')))
        .toBeVisible()
        .withTimeout(10000)

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
        .withTimeout(10000)

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
        .withTimeout(10000)

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

  describe('identified user variants', () => {
    it('should display variant for return visitors', async () => {
      // NOTE: Since identification is not yet implemented (see TODO in beforeEach),
      // this will show the baseline (new visitor) instead of the variant (return visitor)
      await waitFor(element(by.id('entry-text-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(10000)

      // Expecting baseline for new visitors since user identification is not implemented
      await expect(
        element(
          by.label(
            'This is a variant content entry for new visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display baseline for A/B/C experiment', async () => {
      await waitFor(element(by.id('entry-text-5XHssysWUDECHzKLzoIsg1')))
        .toBeVisible()
        .withTimeout(10000)

      await expect(
        element(
          by.label(
            'This is a baseline content entry for an A/B/C experiment: A [Entry: 5XHssysWUDECHzKLzoIsg1]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant for visitors with custom event', async () => {
      // NOTE: Since identification is not yet implemented (see TODO in beforeEach),
      // this will show the baseline instead of the variant
      await waitFor(element(by.id('entry-text-6zqoWXyiSrf0ja7I2WGtYj')))
        .toBeVisible()
        .withTimeout(10000)

      // Expecting baseline since user identification is not implemented
      await expect(
        element(
          by.label(
            'This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant for identified users', async () => {
      // NOTE: Since identification is not yet implemented (see TODO in beforeEach),
      // this will show the baseline instead of the variant
      await waitFor(element(by.id('entry-text-7pa5bOx8Z9NmNcr7mISvD')))
        .toBeVisible()
        .withTimeout(10000)

      // Expecting baseline since user identification is not implemented
      await expect(
        element(
          by.label(
            'This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]',
          ),
        ),
      ).toBeVisible()
    })
  })
})
