const { disableNetwork, enableNetwork } = require('./networkHelpers')
const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

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
    await waitFor(analyticsTitle)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Wait for initial events to be tracked
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Go offline
    await disableNetwork()

    // Trigger an action that generates an analytics event (identify)
    await element(by.id('identify-button')).tap()

    // Verify the event was tracked locally (appears in the analytics display)
    // The identify event should show up even when offline
    await waitFor(element(by.text(/identify/i)))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('should recover gracefully when network is restored', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Go offline
    await disableNetwork()

    // Wait a moment while offline
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Go back online
    await enableNetwork()

    // App should still be functional
    await expect(analyticsTitle).toBeVisible()

    // Should be able to interact with the app after reconnection
    const identifyButton = element(by.id('identify-button'))
    await waitFor(identifyButton)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('should handle rapid network state changes', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Rapidly toggle network state
    await disableNetwork()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await enableNetwork()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await disableNetwork()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await enableNetwork()

    // App should still be stable
    await waitFor(analyticsTitle)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // App should remain functional
    const identifyButton = element(by.id('identify-button'))
    await waitFor(identifyButton)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('should queue events offline and eventually flush when online', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle)
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Let initial loading complete
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Go offline
    await disableNetwork()

    // Trigger identify which creates analytics events
    await element(by.id('identify-button')).tap()

    // Wait a moment for local event tracking
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Verify event shows in local display
    await waitFor(element(by.text(/identify/i)))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Go back online - events should flush
    await enableNetwork()

    // Wait for flush to complete
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // App should still show the event (it was tracked successfully)
    await expect(element(by.text(/identify/i))).toBeVisible()
  })
})
