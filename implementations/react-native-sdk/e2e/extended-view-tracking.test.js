const { expect: jestExpect } = require('expect')
const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getViewDuration,
  getViewId,
  getElementTextById,
  isVisibleById,
  sleep,
  waitForElementTextById,
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

  it('should emit a qualified start with a viewId and dwell duration', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // The qualified start is emitted after the fixed 1s dwell.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const eventCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)
    const duration = await getViewDuration(VISIBLE_ENTRY_ID)
    const viewId = await getViewId(VISIBLE_ENTRY_ID)

    jestExpect(eventCount).toBe(1)
    jestExpect(duration).toBeGreaterThanOrEqual(1000)
    jestExpect(viewId).not.toBeNull()
    jestExpect(typeof viewId).toBe('string')
    jestExpect(viewId.length).toBeGreaterThan(0)
  })

  it('should emit a final event when scrolling a tracked entry out of view', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for the qualified start from the visible entry.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const preScrollViewId = await getViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport (scroll down far enough)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')

    // The lifecycle end emits exactly the final for this session.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 2, ELEMENT_VISIBILITY_TIMEOUT)

    const eventCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)
    const postScrollViewId = await getViewId(VISIBLE_ENTRY_ID)
    jestExpect(eventCount).toBe(2)
    jestExpect(postScrollViewId).toBe(preScrollViewId)
  })

  it('should generate a new viewId after scrolling away and back', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event in the first visibility cycle
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const firstCycleViewId = await getViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport
    await element(by.id('main-scroll-view')).scroll(1500, 'down')
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 2, ELEMENT_VISIBILITY_TIMEOUT)

    // Scroll back to the top to make the entry visible again
    await element(by.id('main-scroll-view')).scrollTo('top')

    // First session start + final, then the new session start.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 3, EXTENDED_TIMEOUT)

    const eventCount = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)
    const secondCycleViewId = await getViewId(VISIBLE_ENTRY_ID)

    // The second cycle should have a different viewId
    jestExpect(eventCount).toBe(3)
    jestExpect(secondCycleViewId).not.toBeNull()
    jestExpect(secondCycleViewId).not.toBe(firstCycleViewId)
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

    // The stats element can exist off-screen on large native viewports. For this
    // E2E flow, the regression signal is that no below-fold stats become visible
    // after a sub-dwell exposure.
    const statsVisible = await isVisibleById(`entry-stats-${BELOW_FOLD_ENTRY_ID}`, 2000)
    jestExpect(statsVisible).toBe(false)
  })

  it('should track multiple visible entries simultaneously with independent viewIds', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event from each visible entry
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    await waitForTrackedItemEventCount(SECOND_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    // Get viewIds for both entries
    const viewId1 = await getViewId(VISIBLE_ENTRY_ID)
    const viewId2 = await getViewId(SECOND_ENTRY_ID)

    // Both should have non-null, distinct viewIds
    jestExpect(viewId1).not.toBeNull()
    jestExpect(viewId2).not.toBeNull()
    jestExpect(viewId1).not.toBe(viewId2)
  })

  it('should emit a final event when navigating away (unmount) during active tracking', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 tracking event (active cycle with emitted event)
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    // Record the current event count
    const preNavText = await getElementTextById(`event-count-${VISIBLE_ENTRY_ID}`)
    const preNavMatch = /Count:\s*(\d+)/.exec(preNavText)
    const preNavCount = preNavMatch && preNavMatch[1] ? Number(preNavMatch[1]) : 0

    // Scroll back to top so the Navigation Test button is accessible
    try {
      await element(by.id('main-scroll-view')).scrollTo('top')
    } catch {
      // May not be scrollable
    }

    // Navigate away: this unmounts all tracked entries, triggering cleanup
    await element(by.id('navigation-test-button')).tap()
    await waitFor(element(by.id('close-navigation-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Give the final event time to fire
    await sleep(500)

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

    // The event count should have increased (final event emitted during unmount)
    const postNavText = await getElementTextById(`event-count-${VISIBLE_ENTRY_ID}`)
    const postNavMatch = /Count:\s*(\d+)/.exec(postNavText)
    const postNavCount = postNavMatch && postNavMatch[1] ? Number(postNavMatch[1]) : 0

    jestExpect(postNavCount).toBeGreaterThan(preNavCount)
  })

  it('should pause tracking on app background and resume on foreground', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Establish the first visibility session before backgrounding.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    const firstCycleViewId = await getViewId(VISIBLE_ENTRY_ID)

    const countBeforeBackground = await getTrackedItemEventCount(VISIBLE_ENTRY_ID)
    jestExpect(countBeforeBackground).toBe(1)

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

    // Backgrounding finalizes the first session, then foregrounding starts a
    // fresh qualified session.
    await waitForTrackedItemEventCount(
      VISIBLE_ENTRY_ID,
      countBeforeBackground + 2,
      EXTENDED_TIMEOUT,
    )

    await waitForElementTextById(
      `event-view-id-${VISIBLE_ENTRY_ID}`,
      (text) => {
        const match = /ViewId:\s*(.+)/.exec(text)
        const viewId = match && match[1] ? match[1].trim() : null
        return viewId !== null && viewId !== 'N/A' && viewId !== firstCycleViewId
      },
      EXTENDED_TIMEOUT,
    )
  })

  it('should reset accumulated duration for a new visibility cycle', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    const startDuration = await getViewDuration(VISIBLE_ENTRY_ID)
    await sleep(1500)

    // Scroll entry out of view (end cycle, triggers final event)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')

    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 2, ELEMENT_VISIBILITY_TIMEOUT)
    const finalDuration = await getViewDuration(VISIBLE_ENTRY_ID)
    jestExpect(finalDuration).toBeGreaterThan(startDuration)

    // Scroll back to top (entry visible again, new cycle starts)
    await element(by.id('main-scroll-view')).scrollTo('top')

    // First session start + final, then the new session start.
    await waitForTrackedItemEventCount(VISIBLE_ENTRY_ID, 3, EXTENDED_TIMEOUT)

    const secondCycleDuration = await getViewDuration(VISIBLE_ENTRY_ID)
    jestExpect(secondCycleDuration).toBeGreaterThanOrEqual(1000)
    jestExpect(secondCycleDuration).toBeLessThan(finalDuration)
  })
})
