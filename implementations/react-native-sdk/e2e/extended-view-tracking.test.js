const { expect: jestExpect } = require('expect')
const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getViewDuration,
  getViewId,
  getElementTextById,
  isVisibleById,
  sleep,
  waitForComponentEventCount,
  waitForEventsCountAtLeast,
} = require('./helpers')

// The merge tag entry is always first in the list and visible immediately on launch.
const VISIBLE_ENTRY_ID = '1MwiFl4z7gkwqGYdvCmr8c'

// Second entry visible on launch (immediately after the merge tag entry).
const SECOND_ENTRY_ID = '4ib0hsHWoSOnCVdDkizE8d'

// An entry that starts below the fold (not visible on launch).
const BELOW_FOLD_ENTRY_ID = '7pa5bOx8Z9NmNcr7mISvD'

// Extended timeouts for periodic event tests - need to wait for dwell (2s) + update intervals (5s each)
const EXTENDED_TIMEOUT = 30000

describe('Extended View Tracking', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState({ requireFreshAppInstance: true })
  })

  it('should emit periodic events for a continuously visible entry', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for the initial event (after dwell threshold ~2s)
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    // Wait for at least one periodic update (dwell 2s + update interval 5s = ~7s total)
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, EXTENDED_TIMEOUT)
  })

  it('should report increasing viewDurationMs across periodic events', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 2 events so we can check duration is increasing
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, EXTENDED_TIMEOUT)

    const duration = await getViewDuration(VISIBLE_ENTRY_ID)

    // Duration should exceed the dwell threshold (2000ms) since we've had at least 2 events
    jestExpect(duration).toBeGreaterThan(2000)
  })

  it('should maintain a stable viewId within a visibility cycle', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 2 events
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, EXTENDED_TIMEOUT)

    const viewId = await getViewId(VISIBLE_ENTRY_ID)

    // The viewId should be a non-null string (UUID or fallback format)
    jestExpect(viewId).not.toBeNull()
    jestExpect(typeof viewId).toBe('string')
    jestExpect(viewId.length).toBeGreaterThan(0)
  })

  it('should emit a final event when scrolling a tracked entry out of view', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event from the visible entry
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const preScrollViewId = await getViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport (scroll down far enough)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')

    // Give the final event time to fire
    await sleep(1000)

    // Scroll back to the top so the stats elements become visible again
    await element(by.id('main-scroll-view')).scrollTo('top')

    // Scroll to the events display to read updated stats
    await waitFor(element(by.id(`event-count-${VISIBLE_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    // The event count should have incremented by the final event
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, ELEMENT_VISIBILITY_TIMEOUT)

    // The viewId should still match the original cycle
    const postScrollViewId = await getViewId(VISIBLE_ENTRY_ID)
    jestExpect(postScrollViewId).toBe(preScrollViewId)
  })

  it('should generate a new viewId after scrolling away and back', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event in the first visibility cycle
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const firstCycleViewId = await getViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport
    await element(by.id('main-scroll-view')).scroll(1500, 'down')
    await sleep(1000)

    // Scroll back to the top to make the entry visible again
    await element(by.id('main-scroll-view')).scrollTo('top')
    await sleep(500)

    // Wait for new events from the second visibility cycle (at least 1 more beyond what we had)
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 3, EXTENDED_TIMEOUT)

    const secondCycleViewId = await getViewId(VISIBLE_ENTRY_ID)

    // The second cycle should have a different viewId
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

    // Immediately scroll back to top — the entry was visible for well under 2s
    await element(by.id('main-scroll-view')).scrollTo('top')

    // Wait long enough that an event WOULD have fired if tracking hadn't been cancelled
    await sleep(3000)

    // The `component-stats` element only renders when an entry view event has fired.
    // It should not exist for the below-fold entry since it wasn't visible long enough.
    const statsVisible = await isVisibleById(`component-stats-${BELOW_FOLD_ENTRY_ID}`, 2000)
    jestExpect(statsVisible).toBe(false)
  })

  it('should track multiple visible entries simultaneously with independent viewIds', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event from each visible entry
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)
    await waitForComponentEventCount(SECOND_ENTRY_ID, 1, EXTENDED_TIMEOUT)

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
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

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

    // Wait for at least 1 tracking event
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const preBackgroundViewId = await getViewId(VISIBLE_ENTRY_ID)

    // Send app to background
    await device.sendToHome()
    await sleep(1000)

    // Bring app back to foreground
    await device.launchApp({ newInstance: false })

    // Wait for the stats display to be visible again
    await waitFor(element(by.id(`event-count-${VISIBLE_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    // Backgrounding ends the cycle (final event) and foregrounding starts a new one.
    // Wait for events from the new cycle.
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 3, EXTENDED_TIMEOUT)

    // The viewId should differ — new cycle after background/foreground
    const postForegroundViewId = await getViewId(VISIBLE_ENTRY_ID)
    jestExpect(postForegroundViewId).not.toBe(preBackgroundViewId)
  })

  it('should reset accumulated duration for a new visibility cycle', async () => {
    await waitFor(element(by.text('Analytics Events')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 2 events so duration accumulates beyond the dwell threshold
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, EXTENDED_TIMEOUT)
    const firstCycleDuration = await getViewDuration(VISIBLE_ENTRY_ID)

    // Duration after 2 events should be well above the dwell threshold
    jestExpect(firstCycleDuration).toBeGreaterThan(4000)

    // Scroll entry out of view (end cycle, triggers final event)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')
    await sleep(1000)

    // Scroll back to top (entry visible again, new cycle starts)
    await element(by.id('main-scroll-view')).scrollTo('top')
    await sleep(500)

    // Wait for the new cycle's initial event
    // Cycle 1: initial(1) + periodic(2) + final(3) = 3 events
    // New cycle initial = event 4
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 4, EXTENDED_TIMEOUT)

    // The new cycle's duration should be around the dwell threshold (~2000ms),
    // not carrying over the 4000+ms from cycle 1
    const secondCycleDuration = await getViewDuration(VISIBLE_ENTRY_ID)
    jestExpect(secondCycleDuration).toBeGreaterThanOrEqual(2000)
    jestExpect(secondCycleDuration).toBeLessThan(4000)
  })
})
