const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getElementTextById,
  sleep,
  waitForTrackedItemEventCount,
} = require('./helpers')

// The merge tag entry is always first in the list and visible immediately on launch.
const VISIBLE_ENTRY_ID = '1MwiFl4z7gkwqGYdvCmr8c'

// Second entry visible on launch (immediately after the merge tag entry).
const SECOND_ENTRY_ID = '4ib0hsHWoSOnCVdDkizE8d'

// An entry that starts below the fold (not visible on launch).
const BELOW_FOLD_ENTRY_ID = '7pa5bOx8Z9NmNcr7mISvD'

// Extended timeout for the 1s dwell plus native rendering and event propagation.
const EXTENDED_TIMEOUT = 30000

async function getTrackedItemEventCount(componentId) {
  const text = await getElementTextById(`event-count-${componentId}`)
  const match = /Count:\s*(\d+)/.exec(text)
  return match && match[1] ? Number(match[1]) : 0
}

describe('Extended View Tracking', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState({ requireFreshAppInstance: true })
  })

  it('should track an entry that remains visible', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // The analytics display shows the entry once its view qualifies.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
  })

  it('should record a view update when scrolling a tracked entry out of view', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for the qualified start from the visible entry.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const beforeScrollCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport (scroll down far enough)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')

    await waitForTrackedItemEventCount(
      VISIBLE_ENTRY_ID,
      beforeScrollCount + 1,
      ELEMENT_VISIBILITY_TIMEOUT,
    )
  })

  it('should track the entry again after scrolling away and back', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event in the first visibility cycle
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const firstViewCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport
    await element(by.id('main-scroll-view')).scroll(1500, 'down')
    await waitForTrackedItemEventCount(
      VISIBLE_ENTRY_ID,
      firstViewCount + 1,
      ELEMENT_VISIBILITY_TIMEOUT,
    )
    const afterScrollCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)

    // Scroll back to the top to make the entry visible again
    await element(by.id('main-scroll-view')).scrollTo('top')

    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, afterScrollCount + 1, EXTENDED_TIMEOUT)
  })

  it('should emit zero events when entry scrolls out before dwell threshold', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Scroll down to bring the below-fold entry into view briefly
    await waitFor(element(by.id(`content-entry-${BELOW_FOLD_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    // Immediately scroll back to top — the entry is intended to remain visible for well under 1s.
    // The lower 10% visibility threshold makes this gesture-bound assertion more timing-sensitive.
    await element(by.id('main-scroll-view')).scrollTo('top')

    // Wait long enough that an event WOULD have fired if tracking hadn't been cancelled
    await sleep(3000)

    // Check absence, since a tracked stats row can exist off-screen.
    await expect(element(by.id(`entry-stats-${BELOW_FOLD_ENTRY_ID}`))).not.toExist()
  })

  it('should track multiple visible entries', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event from each visible entry
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    await waitForTrackedItemEventCount(SECOND_ENTRY_ID, 1, EXTENDED_TIMEOUT)
  })

  it('should record view activity across navigation away and back', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 tracking event (active cycle with emitted event)
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const beforeNavigationCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)

    // Scroll back to top so the Navigation Test button is accessible
    try {
      await element(by.id('main-scroll-view')).scrollTo('top')
    } catch {
      // May not be scrollable
    }

    // Navigate away and back to exercise the visible entry's lifecycle.
    await element(by.id('navigation-test-button')).tap()
    await waitFor(element(by.id('close-navigation-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Navigate back to main screen
    await element(by.id('close-navigation-test-button')).tap()

    // Wait for the events display to reappear (screen remounts with persisted state)
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id(`event-count-${VISIBLE_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    await waitForTrackedItemEventCount(
      VISIBLE_ENTRY_ID,
      beforeNavigationCount + 1,
      EXTENDED_TIMEOUT,
    )
  })

  it('should resume view tracking after app backgrounding', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Establish the first visibility session before backgrounding.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    const countBeforeBackground = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)

    // Send app to background
    await device.sendToHome()
    await sleep(3000)

    // Bring app back to foreground
    await device.launchApp({ newInstance: false })

    // Wait for the stats display to be visible again
    await waitFor(element(by.id(`event-count-${VISIBLE_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    // Backgrounding can end the first exposure; an additional update shows
    // that the visible entry can be observed again after the app returns.
    await waitForTrackedItemEventCount(
      VISIBLE_ENTRY_ID,
      countBeforeBackground + 2,
      EXTENDED_TIMEOUT,
    )
  })
})
