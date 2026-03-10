const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  waitForEventsCountAtLeast,
} = require('./helpers')

describe('Tap Tracking', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  it('should emit component_click when tapping a content entry', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('content-entry-1MwiFl4z7gkwqGYdvCmr8c')).tap()

    await waitForEventsCountAtLeast(1)

    await waitFor(element(by.id('click-stats-1MwiFl4z7gkwqGYdvCmr8c')))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(500, 'down')
  })

  it('should emit component_click for a different entry', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('content-entry-2Z2WLOx07InSewC3LUB3eX')).tap()

    await waitForEventsCountAtLeast(1)

    await waitFor(element(by.id('click-stats-2Z2WLOx07InSewC3LUB3eX')))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(500, 'down')
  })
})
