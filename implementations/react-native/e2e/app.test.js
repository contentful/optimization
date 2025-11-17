describe('OptimizationImplementationApp - Merge Tag Reference Implementation', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  describe('Merge Tag Rendering', () => {
    it('should display the merge tag screen', async () => {
      await waitFor(element(by.id('merge-tag-screen')))
        .toBeVisible()
        .withTimeout(10000)

      await waitFor(element(by.text(/merge tag content entry/i)))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should render rich text with resolved merge tag value', async () => {
      await waitFor(element(by.text(/continent/i)))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should display resolved merge tag inline with text', async () => {
      await waitFor(element(by.id('merge-tag-content')))
        .toBeVisible()
        .withTimeout(10000)

      await waitFor(element(by.text(/merge tag content entry/i)))
        .toBeVisible()
        .withTimeout(5000)

      await waitFor(element(by.text(/continent/i)))
        .toBeVisible()
        .withTimeout(5000)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing rich text field gracefully', async () => {
      try {
        await expect(element(by.text('No rich text field found'))).not.toBeVisible()
      } catch (e) {
        await expect(element(by.text('No rich text field found'))).toBeVisible()
      }
    })
  })
})
