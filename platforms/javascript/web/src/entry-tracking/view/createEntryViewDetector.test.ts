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
    tracker.trackElement(element, { data: { entryId: 'manual-view-entry' }, dwellTimeMs: 0 })

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
      }),
    )

    cleanup()
  })

  it('stops tracking after manual unobserve', async () => {
    const element = document.createElement('article')
    document.body.append(element)

    const { core, trackComponentView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.trackElement(element, { data: { entryId: 'manual-view-entry' }, dwellTimeMs: 0 })
    tracker.untrackElement(element)

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackComponentView).not.toHaveBeenCalled()

    cleanup()
  })
})
