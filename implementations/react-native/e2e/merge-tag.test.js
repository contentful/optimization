const { expect: jestExpect } = require('@jest/globals')
const { clearProfileState } = require('./helpers')

describe('Merge Tag Section', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  describe('Merge Tag Rendering', () => {
    it('should display the merge tag section', async () => {
      await waitFor(element(by.id('merge-tag-section')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should render merge tag content', async () => {
      await waitFor(element(by.id('merge-tag-content')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display merge tag text', async () => {
      await waitFor(element(by.id('rich-text-renderer')))
        .toBeVisible()
        .withTimeout(10000)

      const paragraphElement = element(by.id('rich-text-paragraph-0'))
      await waitFor(paragraphElement).toBeVisible().withTimeout(10000)

      const text = await paragraphElement.getAttributes()
      const contentText = text.text || text.label
      jestExpect(contentText).toBeTruthy()
      jestExpect(contentText.toLowerCase()).toContain('merge tag content entry')
    })

    it('should render rich text with resolved merge tag value', async () => {
      const paragraphElement = element(by.id('rich-text-paragraph-0'))
      await waitFor(paragraphElement).toBeVisible().withTimeout(10000)

      const paragraphAttributes = await paragraphElement.getAttributes()
      const contentText = paragraphAttributes.text || paragraphAttributes.label

      jestExpect(contentText).toBeTruthy()
      jestExpect(contentText.toLowerCase()).toContain('continent')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing rich text field gracefully', async () => {
      try {
        await expect(element(by.id('merge-tag-error'))).not.toBeVisible()
      } catch (e) {
        const errorElement = element(by.id('merge-tag-error'))
        await waitFor(errorElement).toBeVisible().withTimeout(10000)
        const text = await errorElement.getAttributes()
        const errorText = text.text || text.label
        jestExpect(errorText).toBe('No rich text field found')
      }
    })
  })
})
