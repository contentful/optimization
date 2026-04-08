const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  waitForTrackedItemEventCount,
} = require('./helpers')

describe('Flag View Tracking', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState({ requireFreshAppInstance: true })
  })

  it('should emit flag view events for the subscribed boolean flag', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitForTrackedItemEventCount('boolean', 1, ELEMENT_VISIBILITY_TIMEOUT)
  })
})
