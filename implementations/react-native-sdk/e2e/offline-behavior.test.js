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

// Time allowed after reconnecting for NetInfo to flip the SDK online signal and
// for the resulting queue flush (an Experience API round-trip) to land before
// the app is terminated. The mock API is local, but this stays generous so the
// flush is never raced by the terminate even on a loaded emulator.
const QUEUE_FLUSH_GRACE_MS = 10000

// Time allowed after an online identify for the Experience upsert round-trip to
// complete before the app is terminated. `handleIdentify` fires the SDK call
// with `void`, so the HTTP request can still be in flight when identify returns.
const IDENTIFY_SETTLE_MS = 3000

// Timeout for the post-relaunch variant assertions. A cold start has to boot
// the JS bundle, fetch every entry, and run resolution before the nested tree
// appears, which can exceed the standard element timeout on a loaded emulator.
const POST_RELAUNCH_TIMEOUT = 30000

// Nested level-0 entry ids. The host app never fetches these directly; the
// NestedContentItem testID is keyed off the SDK-resolved entry, so the variant
// id only appears once the SDK resolves the *identified* profile and the
// baseline id only appears for an *anonymous* profile. They are therefore an
// honest, SDK-coupled signal of which profile the SDK actually resolved after
// an offline/online cycle — something static text and local-state buttons
// (the old assertions) could never prove.
const NESTED_VARIANT_TEST_ID = 'entry-text-2KIWllNZJT205BwOSkMINg'
const NESTED_BASELINE_TEST_ID = 'entry-text-1JAU028vQ7v6nB2swl3NBo'

describe('Offline Behavior', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    // Restore connectivity first, then relaunch from clean storage. Each test
    // identifies and leaves the app in an identified state, so a fresh instance
    // is required to guarantee the next test starts from a true anonymous
    // profile with an unidentified variant resolution.
    await enableNetwork()
    await clearProfileState({ requireFreshAppInstance: true })
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

    // The SDK must still emit the identify event to its in-process eventStream
    // while offline — the analytics counter advances with no network.
    await waitForElementTextById(
      'events-count',
      (text) => parseEventsCount(text) >= eventsBeforeIdentify + 1,
      ELEMENT_VISIBILITY_TIMEOUT,
    )

    // Counter emission alone is not proof the event was *retained*: a queue
    // that silently discards offline events would tick the counter exactly the
    // same way. Reconnect so the Experience queue flushes, give the flush
    // round-trip time to land, then relaunch. The identified-only nested
    // variant id can only resolve if the offline identify was genuinely queued
    // and delivered on reconnect — if it had been dropped, the relaunched app
    // would resolve the anonymous baseline id instead.
    await enableNetwork()
    await pause(QUEUE_FLUSH_GRACE_MS)
    await device.terminateApp()
    await device.launchApp({ newInstance: true })

    await waitFor(element(by.id(NESTED_VARIANT_TEST_ID)))
      .toExist()
      .withTimeout(POST_RELAUNCH_TIMEOUT)
    await expect(element(by.id(NESTED_BASELINE_TEST_ID))).not.toExist()
  })

  it('should recover gracefully when network is restored', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Take the SDK through an offline -> online transition.
    await disableNetwork()
    await pause(1000)
    await enableNetwork()

    // "Recovered gracefully" must mean more than "static text is still on
    // screen" — that is true even against a fully dead SDK. The real proof of
    // recovery is that the SDK can still complete an end-to-end identify
    // pipeline after the blip: identify -> Experience upsert ->
    // selectedOptimizations -> variant resolution. The identify here runs
    // while online, so let the connectivity transition settle first.
    await pause(IDENTIFY_SETTLE_MS)
    await element(by.id('identify-button')).tap()
    await waitFor(element(by.id('reset-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Give the Experience upsert round-trip time to land, then relaunch to
    // observe the resolved profile. The identified-only nested variant id can
    // only render if the post-recovery identify pipeline ran successfully.
    await pause(IDENTIFY_SETTLE_MS)
    await device.terminateApp()
    await device.launchApp({ newInstance: true })

    await waitFor(element(by.id(NESTED_VARIANT_TEST_ID)))
      .toExist()
      .withTimeout(POST_RELAUNCH_TIMEOUT)
    await expect(element(by.id(NESTED_BASELINE_TEST_ID))).not.toExist()
  })

  it('should handle rapid network state changes', async () => {
    // Wait for app to load
    const analyticsTitle = element(by.text('Analytics Events'))
    await waitFor(analyticsTitle).toBeVisible().withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Rapidly toggle network state, ending online.
    await disableNetwork()
    await pause(500)
    await enableNetwork()
    await pause(500)
    await disableNetwork()
    await pause(500)
    await enableNetwork()

    // The old test only checked that static text survived a burst of NetInfo
    // events — a no-op SDK passed it trivially. Instead, prove the SDK is still
    // fully operational after the churn: a complete identify pipeline must
    // still resolve the identified-only nested variant after relaunch. A wedged
    // SDK (stuck offline signal, broken queue) would resolve the baseline.
    await pause(IDENTIFY_SETTLE_MS)
    await element(by.id('identify-button')).tap()
    await waitFor(element(by.id('reset-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await pause(IDENTIFY_SETTLE_MS)
    await device.terminateApp()
    await device.launchApp({ newInstance: true })

    await waitFor(element(by.id(NESTED_VARIANT_TEST_ID)))
      .toExist()
      .withTimeout(POST_RELAUNCH_TIMEOUT)
    await expect(element(by.id(NESTED_BASELINE_TEST_ID))).not.toExist()
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

    // Go back online so the offline Experience queue flushes, and give the
    // flush round-trip time to reach the server before the app is killed.
    await enableNetwork()
    await pause(QUEUE_FLUSH_GRACE_MS)

    // Relaunch and verify the queued-then-flushed identify actually took
    // effect end to end:
    //  - the identified-only nested variant id resolves, proving the flushed
    //    identify reached the Experience API and the resulting
    //    selectedOptimizations persisted across the cold start;
    //  - `reset-button` is visible, which App.tsx renders only when the
    //    rehydrated `sdk.states.profile` reports an identified profile —
    //    proving the identified profile state was preserved, not just the
    //    variant data.
    await device.terminateApp()
    await device.launchApp({ newInstance: true })

    await waitFor(element(by.id(NESTED_VARIANT_TEST_ID)))
      .toExist()
      .withTimeout(POST_RELAUNCH_TIMEOUT)
    await expect(element(by.id(NESTED_BASELINE_TEST_ID))).not.toExist()
    await waitFor(element(by.id('reset-button')))
      .toBeVisible()
      .withTimeout(POST_RELAUNCH_TIMEOUT)
  })
})
