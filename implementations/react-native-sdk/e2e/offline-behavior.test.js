const { disableNetwork, enableNetwork } = require('./networkHelpers')
const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getElementTextById,
  waitForElementTextById,
  waitForEventsCountAtLeast,
} = require('./helpers')

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseEventsCount(text) {
  const match = /Events:\s*(\d+)/.exec(text)
  return match && match[1] ? Number(match[1]) : 0
}

async function getEventsCount() {
  return parseEventsCount(await getElementTextById('events-count'))
}

describe('Offline Behavior', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
    // Ensure network is enabled at start of each test
    await enableNetwork()
  })

  afterEach(async () => {
    // Always restore network after each test to avoid affecting other tests
    await enableNetwork()
  })

  it('should continue to track events while offline', async () => {
    // Wait for app to load and initial content to appear
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for initial events to be tracked
    await waitForEventsCountAtLeast(1)

    // Go offline
    await disableNetwork()

    const eventsBeforeIdentify = await getEventsCount()

    // Trigger an action that generates an Experience API event (identify)
    await element(by.id('identify-button')).tap()

    // Verify the event counter increased while offline.
    await waitForElementTextById(
      'events-count',
      (text) => parseEventsCount(text) >= eventsBeforeIdentify + 1,
      ELEMENT_VISIBILITY_TIMEOUT,
    )
  })

  it('should recover gracefully when network is restored', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Go offline
    await disableNetwork()

    // Allow offline state to stabilize before reconnecting.
    await pause(1000)

    // Go back online
    await enableNetwork()

    // App should still be functional
    await expect(analyticsTitle).toBeVisible()

    // Should be able to interact with the app after reconnection
    const identifyButton = element(by.id('identify-button'))
    await waitFor(identifyButton).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('should handle rapid network state changes', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Rapidly toggle network state
    await disableNetwork()
    await pause(500)
    await enableNetwork()
    await pause(500)
    await disableNetwork()
    await pause(500)
    await enableNetwork()

    // App should still be stable
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // App should remain functional
    const identifyButton = element(by.id('identify-button'))
    await waitFor(identifyButton).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('should queue events offline and eventually flush when online', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for initial events to be tracked
    await waitForEventsCountAtLeast(1)

    // Go offline
    await disableNetwork()

    const eventsBeforeIdentify = await getEventsCount()

    // Trigger identify, which creates an Experience API event
    await element(by.id('identify-button')).tap()

    // Verify event counter increased while still offline.
    await waitForElementTextById(
      'events-count',
      (text) => parseEventsCount(text) >= eventsBeforeIdentify + 1,
      ELEMENT_VISIBILITY_TIMEOUT,
    )

    // Go back online - events should flush
    await enableNetwork()

    // App should remain functional after reconnect and preserve identified state.
    await waitFor(element(by.id('reset-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })
})
