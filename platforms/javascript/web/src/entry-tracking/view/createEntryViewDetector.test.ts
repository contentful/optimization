import { advance, createEntryTrackingHarness, installIOPolyfill } from '../../test/helpers'
import { createEntryViewDetector, type EntryViewTrackingCore } from './createEntryViewDetector'

function createCore(): {
  core: EntryViewTrackingCore
  trackComponentView: ReturnType<typeof rs.fn>
} {
  const trackComponentView = rs.fn().mockResolvedValue(undefined)

  const core: EntryViewTrackingCore = {
    trackComponentView,
  }

  return { core, trackComponentView }
}

describe('EntryViewTracker', () => {
  const io = installIOPolyfill()

  beforeEach(() => {
    rs.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    rs.clearAllTimers()
    rs.restoreAllMocks()
  })

  afterAll(() => {
    io.restore()
  })

  it('auto-observes discovered entry elements and tracks views', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).toHaveBeenCalledTimes(1)
    expect(trackComponentView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-view',
        componentViewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('prefers manual data when manually observing an element', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.enableElement(element, { data: { entryId: 'manual-view-entry' }, dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).toHaveBeenCalledTimes(1)
    expect(trackComponentView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-view-entry',
        componentViewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('stops tracking after clearing a manual element override', async () => {
    const element = document.createElement('article')
    document.body.append(element)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.enableElement(element, { data: { entryId: 'manual-view-entry' }, dwellTimeMs: 0 })
    tracker.clearElement(element)

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).not.toHaveBeenCalled()

    cleanup()
  })

  it('stops tracking an auto-observed entry after explicit disable override', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-disabled'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.disableElement(entry)

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).not.toHaveBeenCalled()

    cleanup()
  })

  it('disables view tracking for auto-tracked entries via data-ctfl-track-views=false', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-disabled-by-data'
    entry.dataset.ctflTrackViews = 'false'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).not.toHaveBeenCalled()

    cleanup()
  })

  it('force-enables view tracking via data-ctfl-track-views=true when auto-tracking is disabled', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-enabled-by-data'
    entry.dataset.ctflTrackViews = 'true'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.setAuto(false)
    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).toHaveBeenCalledTimes(1)
    expect(trackComponentView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-view-enabled-by-data',
        componentViewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('emits periodic duration updates while an observed entry remains visible', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-periodic-view'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 1000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await advance(1000)

    expect(trackComponentView).toHaveBeenCalledTimes(2)

    const firstPayload = trackComponentView.mock.calls[0]?.[0]
    const secondPayload = trackComponentView.mock.calls[1]?.[0]

    expect(firstPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-view',
        componentViewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )
    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-view',
        componentViewId: firstPayload?.componentViewId,
        viewDurationMs: 1000,
      }),
    )

    cleanup()
  })

  it('applies view-duration interval override from data attributes for auto-tracked entries', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-attr-interval'
    entry.dataset.ctflViewDurationUpdateIntervalMs = '250'
    document.body.append(entry)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await advance(250)

    expect(trackComponentView).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('applies view-duration interval override for manually enabled elements', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })
    tracker.enableElement(element, {
      data: { entryId: 'manual-interval-entry' },
      dwellTimeMs: 0,
      viewDurationUpdateIntervalMs: 200,
    })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await advance(200)

    expect(trackComponentView).toHaveBeenCalledTimes(2)

    cleanup()
  })
})
