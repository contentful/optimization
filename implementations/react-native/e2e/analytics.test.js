const { clearProfileState } = require('./helpers')

describe('Analytics Events', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  it('should display Analytics Events title', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(10000)
  })

  it('should track page event', async () => {
    // Wait for the app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(10000)

    // Look for page event in the analytics display
    const pageEvent = element(by.text(/^page$/))
    await waitFor(pageEvent).toBeVisible().withTimeout(15000)
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

  it('should track multiple component events as user scrolls', async () => {
    // Wait for the app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(10000)

    // Scroll down to ensure more entries are visible
    await element(by.type('RCTScrollView')).scrollTo('bottom')

    // Wait for events to be tracked
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Should see multiple component events
    // Look for any component event text pattern
    const anyComponentEvent = element(by.text(/component - Component:/i))
    await expect(anyComponentEvent).toBeVisible()
  })

  it('should display entry IDs in the event stream', async () => {
    // Wait for the app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(10000)

    // Wait for content to be tracked
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Check that entry IDs are visible in the UI (from the [Entry: X] labels)
    const entryLabel = element(by.text(/\[Entry: /))
    await waitFor(entryLabel).toBeVisible().withTimeout(10000)
  })
})
