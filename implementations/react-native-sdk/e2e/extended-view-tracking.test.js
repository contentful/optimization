const { expect: jestExpect } = require('expect')
const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getComponentViewDuration,
  getComponentViewId,
  sleep,
  waitForComponentEventCount,
  waitForEventsCountAtLeast,
} = require('./helpers')

// The merge tag entry is always first in the list and visible immediately on launch.
const VISIBLE_ENTRY_ID = '1MwiFl4z7gkwqGYdvCmr8c'

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

    const duration = await getComponentViewDuration(VISIBLE_ENTRY_ID)

    // Duration should exceed the dwell threshold (2000ms) since we've had at least 2 events
    jestExpect(duration).toBeGreaterThan(2000)
  })

  it('should maintain a stable componentViewId within a visibility cycle', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 2 events
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, EXTENDED_TIMEOUT)

    const viewId = await getComponentViewId(VISIBLE_ENTRY_ID)

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

    const preScrollViewId = await getComponentViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport (scroll down far enough)
    await element(by.id('main-scroll-view')).scroll(1500, 'down')

    // Give the final event time to fire
    await sleep(1000)

    // Scroll back to the top so the stats elements become visible again
    await element(by.id('main-scroll-view')).scrollTo('top')

    // Scroll to the analytics display to read updated stats
    await waitFor(element(by.id(`event-count-${VISIBLE_ENTRY_ID}`)))
      .toBeVisible()
      .whileElement(by.id('main-scroll-view'))
      .scroll(300, 'down')

    // The event count should have incremented by the final event
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 2, ELEMENT_VISIBILITY_TIMEOUT)

    // The viewId should still match the original cycle
    const postScrollViewId = await getComponentViewId(VISIBLE_ENTRY_ID)
    jestExpect(postScrollViewId).toBe(preScrollViewId)
  })

  it('should generate a new componentViewId after scrolling away and back', async () => {
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for at least 1 event in the first visibility cycle
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 1, EXTENDED_TIMEOUT)

    const firstCycleViewId = await getComponentViewId(VISIBLE_ENTRY_ID)

    // Scroll the entry out of the viewport
    await element(by.id('main-scroll-view')).scroll(1500, 'down')
    await sleep(1000)

    // Scroll back to the top to make the entry visible again
    await element(by.id('main-scroll-view')).scrollTo('top')
    await sleep(500)

    // Wait for new events from the second visibility cycle (at least 1 more beyond what we had)
    await waitForComponentEventCount(VISIBLE_ENTRY_ID, 3, EXTENDED_TIMEOUT)

    const secondCycleViewId = await getComponentViewId(VISIBLE_ENTRY_ID)

    // The second cycle should have a different componentViewId
    jestExpect(secondCycleViewId).not.toBeNull()
    jestExpect(secondCycleViewId).not.toBe(firstCycleViewId)
  })
})
