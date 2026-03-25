const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  waitForEventsCountAtLeast,
} = require('./helpers')

describe('Insights API Events', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  it('should track entry view events for visible entries', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitForEventsCountAtLeast(1)

    // With periodic tracking, per-entry stats are rendered with unique test IDs.
    // Use the `component-stats` summary element to verify the merge tag entry was tracked.
    await waitFor(element(by.id('component-stats-1MwiFl4z7gkwqGYdvCmr8c')))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(500, 'down')
  })
})
