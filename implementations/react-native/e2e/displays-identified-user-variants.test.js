const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

describe('identified user', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()

    await waitFor(element(by.id('identify-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('identify-button')).tap()

    await device.reloadReactNative()
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

  describe('identified user variants', () => {
    it('should display variant for return visitors', async () => {
      await waitFor(element(by.id('entry-text-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a variant content entry for return visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]',
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

    it('should display variant for visitors with custom event', async () => {
      await waitFor(element(by.id('entry-text-6zqoWXyiSrf0ja7I2WGtYj')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]',
          ),
        ),
      ).toBeVisible()
    })

    it('should display variant for identified users', async () => {
      await waitFor(element(by.id('entry-text-7pa5bOx8Z9NmNcr7mISvD')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label(
            'This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]',
          ),
        ),
      ).toBeVisible()
    })
  })

  describe('nested personalization variants', () => {
    it('should display level 0 nested variant for return visitors', async () => {
      await waitFor(element(by.id('entry-text-2KIWllNZJT205BwOSkMINg')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 0 nested variant entry. [Entry: 2KIWllNZJT205BwOSkMINg]'),
        ),
      ).toBeVisible()
    })

    it('should display level 1 nested variant for return visitors', async () => {
      await waitFor(element(by.id('entry-text-5a8ONfBdanJtlJ39WWnH1w')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 1 nested variant entry. [Entry: 5a8ONfBdanJtlJ39WWnH1w]'),
        ),
      ).toBeVisible()
    })

    it('should display level 2 nested variant for return visitors', async () => {
      await waitFor(element(by.id('entry-text-4hDiXxYEFrXHXcQgmdL9Uv')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await expect(
        element(
          by.label('This is a level 2 nested variant entry. [Entry: 4hDiXxYEFrXHXcQgmdL9Uv]'),
        ),
      ).toBeVisible()
    })
  })
})
