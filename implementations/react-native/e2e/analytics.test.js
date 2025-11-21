const { clearProfileState } = require('./helpers')

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
    await waitFor(analyticsTitle).toBeVisible().withTimeout(10000)

    // Wait a bit for content to load and be visible
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Look for component events with entry IDs
    // The merge tag entry should trigger a component event
    const componentEvent = element(by.text(/component - Component: 1MwiFl4z7gkwqGYdvCmr8c/i))
    await waitFor(componentEvent).toBeVisible().withTimeout(15000)
  })
})
