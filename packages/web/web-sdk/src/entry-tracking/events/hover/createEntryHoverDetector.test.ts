import { advance, createEntryTrackingHarness } from '../../../test/helpers'
import { createEntryHoverDetector, type EntryHoverTrackingCore } from './createEntryHoverDetector'

function createCore(): {
  core: EntryHoverTrackingCore
  trackComponentHover: ReturnType<typeof rs.fn>
} {
  const trackComponentHover = rs.fn().mockResolvedValue(undefined)

  const core: EntryHoverTrackingCore = {
    trackComponentHover,
  }

  return { core, trackComponentHover }
}

const canUsePointerEvents = (): boolean =>
  typeof window !== 'undefined' &&
  typeof PointerEvent !== 'undefined' &&
  typeof window.PointerEvent === 'function'

const dispatchHoverEnter = (element: Element): void => {
  if (canUsePointerEvents()) {
    element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    return
  }

  element.dispatchEvent(new MouseEvent('mouseenter'))
}

const dispatchHoverLeave = (element: Element): void => {
  if (canUsePointerEvents()) {
    element.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    return
  }

  element.dispatchEvent(new MouseEvent('mouseleave'))
}

describe('EntryHoverTracker', () => {
  beforeEach(() => {
    rs.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    rs.clearAllTimers()
    rs.restoreAllMocks()
  })

  it('auto-observes discovered entry elements and tracks hovers', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-hover'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    dispatchHoverEnter(entry)
    await advance(0)

    expect(trackComponentHover).toHaveBeenCalledTimes(1)
    expect(trackComponentHover).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-hover',
        componentHoverId: expect.any(String),
        hoverDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('prefers manual data when manually observing an element', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.enableElement(element, { data: { entryId: 'manual-hover-entry' }, dwellTimeMs: 0 })

    dispatchHoverEnter(element)
    await advance(0)

    expect(trackComponentHover).toHaveBeenCalledTimes(1)
    expect(trackComponentHover).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-hover-entry',
        componentHoverId: expect.any(String),
        hoverDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('stops tracking after clearing a manual element override', async () => {
    const element = document.createElement('article')
    document.body.append(element)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.enableElement(element, { data: { entryId: 'manual-hover-entry' }, dwellTimeMs: 0 })
    tracker.clearElement(element)

    dispatchHoverEnter(element)
    await advance(0)

    expect(trackComponentHover).not.toHaveBeenCalled()

    cleanup()
  })

  it('stops tracking an auto-observed entry after explicit disable override', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-hover-disabled'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.disableElement(entry)

    dispatchHoverEnter(entry)
    await advance(0)

    expect(trackComponentHover).not.toHaveBeenCalled()

    cleanup()
  })

  it('disables hover tracking for auto-tracked entries via data-ctfl-track-hovers=false', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-hover-disabled-by-data'
    entry.dataset.ctflTrackHovers = 'false'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    dispatchHoverEnter(entry)
    await advance(0)

    expect(trackComponentHover).not.toHaveBeenCalled()

    cleanup()
  })

  it('force-enables hover tracking via data-ctfl-track-hovers=true when auto-tracking is disabled', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-hover-enabled-by-data'
    entry.dataset.ctflTrackHovers = 'true'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.setAuto(false)
    tracker.start({ dwellTimeMs: 0 })

    dispatchHoverEnter(entry)
    await advance(0)

    expect(trackComponentHover).toHaveBeenCalledTimes(1)
    expect(trackComponentHover).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-hover-enabled-by-data',
        componentHoverId: expect.any(String),
        hoverDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('emits periodic duration updates while an observed entry remains hovered', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-periodic-hover'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0, hoverDurationUpdateIntervalMs: 1000 })

    dispatchHoverEnter(entry)

    await advance(0)
    await advance(1000)

    expect(trackComponentHover).toHaveBeenCalledTimes(2)

    const firstPayload = trackComponentHover.mock.calls[0]?.[0]
    const secondPayload = trackComponentHover.mock.calls[1]?.[0]

    expect(firstPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-hover',
        componentHoverId: expect.any(String),
        hoverDurationMs: 0,
      }),
    )
    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-hover',
        componentHoverId: firstPayload?.componentHoverId,
        hoverDurationMs: 1000,
      }),
    )

    cleanup()
  })

  it('emits a final duration update when hover ends', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-hover-final'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0, hoverDurationUpdateIntervalMs: 10_000 })

    dispatchHoverEnter(entry)
    await advance(0)
    await advance(500)
    dispatchHoverLeave(entry)
    await Promise.resolve()

    expect(trackComponentHover).toHaveBeenCalledTimes(2)

    const firstPayload = trackComponentHover.mock.calls[0]?.[0]
    const secondPayload = trackComponentHover.mock.calls[1]?.[0]

    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-hover-final',
        componentHoverId: firstPayload?.componentHoverId,
        hoverDurationMs: 500,
      }),
    )

    cleanup()
  })

  it('applies hover-duration interval override from data attributes for auto-tracked entries', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-attr-hover-interval'
    entry.dataset.ctflHoverDurationUpdateIntervalMs = '250'
    document.body.append(entry)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0, hoverDurationUpdateIntervalMs: 10_000 })

    dispatchHoverEnter(entry)

    await advance(0)
    await advance(250)

    expect(trackComponentHover).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('applies hover-duration interval override for manually enabled elements', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0, hoverDurationUpdateIntervalMs: 10_000 })
    tracker.enableElement(element, {
      data: { entryId: 'manual-hover-interval-entry' },
      dwellTimeMs: 0,
      hoverDurationUpdateIntervalMs: 200,
    })

    dispatchHoverEnter(element)

    await advance(0)
    await advance(200)

    expect(trackComponentHover).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('does not call preventDefault or stopPropagation while observing hover events', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-hover-non-interference'
    document.body.append(entry)

    const preventDefaultSpy = rs.spyOn(Event.prototype, 'preventDefault')
    const stopPropagationSpy = rs.spyOn(Event.prototype, 'stopPropagation')

    const { core, trackComponentHover } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryHoverDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    dispatchHoverEnter(entry)
    await advance(0)

    expect(trackComponentHover).toHaveBeenCalledTimes(1)
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()

    cleanup()
  })
})
