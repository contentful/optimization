describe('Analytics Section', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  describe('Analytics Rendering', () => {
    it('should display content text', async () => {
      await waitFor(element(by.id('analytics-content-text')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should track and display component impression event', async () => {
      await waitFor(element(by.id('analytics-content')))
        .toBeVisible()
        .withTimeout(10000)

      await waitFor(element(by.id('analytics-event-component-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})
