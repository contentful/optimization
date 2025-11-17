const { expect: jestExpect } = require('@jest/globals')

describe('Analytics Section', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  describe('Analytics Rendering', () => {
    it('should display the analytics section', async () => {
      await waitFor(element(by.id('analytics-section')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display the analytics section', async () => {
      await waitFor(element(by.id('analytics-section')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display analytics content', async () => {
      await waitFor(element(by.id('analytics-content')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display internal title', async () => {
      await waitFor(element(by.id('analytics-internal-title')))
        .toBeVisible()
        .withTimeout(10000)

      const internalTitleElement = element(by.id('analytics-internal-title'))
      await expect(internalTitleElement).toBeVisible()
      const text = await internalTitleElement.getAttributes()
      const titleText = text.text || text.label
      jestExpect(titleText).toBeTruthy()
      jestExpect(titleText).toBe('[Baseline] All New or Return Visitors')
    })

    it('should display content text', async () => {
      await waitFor(element(by.id('analytics-content-text')))
        .toBeVisible()
        .withTimeout(10000)

      const contentTextElement = element(by.id('analytics-content-text'))
      await expect(contentTextElement).toBeVisible()
      const text = await contentTextElement.getAttributes()
      const contentText = text.text || text.label
      jestExpect(contentText).toBeTruthy()
      jestExpect(contentText).toBe('This is a baseline content entry for all users.')
    })

    it('should display entry ID', async () => {
      await waitFor(element(by.id('analytics-entry-id')))
        .toBeVisible()
        .withTimeout(10000)

      const entryIdElement = element(by.id('analytics-entry-id'))
      await expect(entryIdElement).toBeVisible()
      const text = await entryIdElement.getAttributes()
      const entryId = text.text || text.label
      jestExpect(entryId).toBeTruthy()
      jestExpect(entryId).toBe('2Z2WLOx07InSewC3LUB3eX')
    })

    it('should display tracking status', async () => {
      await waitFor(element(by.id('analytics-tracking-status')))
        .toBeVisible()
        .withTimeout(10000)

      await new Promise((resolve) => setTimeout(resolve, 2500))

      const trackingStatusTextElement = element(by.id('analytics-tracking-status-text'))
      await waitFor(trackingStatusTextElement).toBeVisible().withTimeout(10000)

      const text = await trackingStatusTextElement.getAttributes()
      jestExpect(text.text || text.label).toBe('Tracked Successfully')
    })
  })
})
