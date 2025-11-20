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

    it('should display component event', async () => {
      await waitFor(element(by.id('analytics-content')))
        .toBeVisible()
        .withTimeout(10000)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await waitFor(element(by.id('analytics-event-component-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
