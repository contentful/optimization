const { expect: jestExpect } = require('@jest/globals')
const { clearProfileState } = require('./helpers')

describe('Personalization Section', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  describe('Personalization Rendering', () => {
    it('should display personalization content', async () => {
      await waitFor(element(by.id('personalization-content')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display internal title', async () => {
      await waitFor(element(by.id('personalization-internal-title')))
        .toBeVisible()
        .withTimeout(10000)

      const internalTitleElement = element(by.id('personalization-internal-title'))
      await expect(internalTitleElement).toBeVisible()
      const text = await internalTitleElement.getAttributes()
      const titleText = text.text || text.label
      jestExpect(titleText).toBeTruthy()
      jestExpect('[Variant] New Visitors').toBe(titleText)
    })

    it('should display content text', async () => {
      await waitFor(element(by.id('personalization-content-text')))
        .toBeVisible()
        .withTimeout(10000)

      const contentTextElement = element(by.id('personalization-content-text'))
      await expect(contentTextElement).toBeVisible()
      const text = await contentTextElement.getAttributes()
      const contentText = text.text || text.label
      jestExpect(contentText).toBeTruthy()
      jestExpect(contentText).toBe('This is a variant content entry for new visitors.')
    })

    it('should display entry ID', async () => {
      await waitFor(element(by.id('personalization-entry-id')))
        .toBeVisible()
        .withTimeout(10000)

      const entryIdElement = element(by.id('personalization-entry-id'))
      await expect(entryIdElement).toBeVisible()
      const text = await entryIdElement.getAttributes()
      const entryId = text.text || text.label
      jestExpect(entryId).toBeTruthy()
      jestExpect(entryId).toBe('1UFf7qr4mHET3HYuYmcpEj')
    })

    it('should display component event', async () => {
      await waitFor(element(by.id('personalization-content')))
        .toBeVisible()
        .withTimeout(10000)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await waitFor(element(by.id('personalization-event-component-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
