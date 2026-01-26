const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

describe('Analytics Events', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  it('should track component impression events for visible entries', async () => {
    // Wait for the app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait a bit for content to load and be visible
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Look for component events with entry IDs
    // The merge tag entry should trigger a component event
    // Use waitFor().whileElement().scroll() pattern to scroll until element is visible
    await waitFor(element(by.id('event-component-1MwiFl4z7gkwqGYdvCmr8c')))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(500, 'down')
  })
})
