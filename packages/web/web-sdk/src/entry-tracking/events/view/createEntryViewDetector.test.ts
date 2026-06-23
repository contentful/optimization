import { advance, createEntryTrackingHarness, installIOPolyfill } from '../../../test/helpers'
import { createEntryViewDetector, type EntryViewTrackingCore } from './createEntryViewDetector'

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  new DOMRect(left, top, width, height)

const setRect = (element: Element, value: DOMRectReadOnly): void => {
  rs.spyOn(element, 'getBoundingClientRect').mockReturnValue(value)
}

const toDomRectList = (rects: DOMRect[]): DOMRectList => {
  const list: DOMRectList = {
    [Symbol.iterator]: () => rects[Symbol.iterator](),
    item: (index: number): DOMRect | null => rects[index] ?? null,
    length: rects.length,
  }

  rects.forEach((value, index) => {
    Object.defineProperty(list, index, { value })
  })

  return list
}

const stubRangeRects = (rectsByElement: Map<Element, DOMRect[]>): void => {
  let selected: Element | undefined
  const range = document.createRange()

  rs.spyOn(range, 'detach').mockImplementation(() => undefined)
  rs.spyOn(range, 'getClientRects').mockImplementation(() =>
    toDomRectList(selected ? (rectsByElement.get(selected) ?? []) : []),
  )
  rs.spyOn(range, 'selectNodeContents').mockImplementation((node: Node) => {
    selected = node instanceof Element ? node : undefined
  })
  rs.spyOn(document, 'createRange').mockReturnValue(range)
}

function createCore(): {
  core: EntryViewTrackingCore
  trackView: ReturnType<typeof rs.fn>
} {
  const trackView = rs.fn().mockResolvedValue(undefined)

  const core: EntryViewTrackingCore = {
    trackView,
  }

  return { core, trackView }
}

describe('EntryViewTracker', () => {
  const io = installIOPolyfill()

  beforeEach(() => {
    rs.useFakeTimers()
    rs.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number =>
      window.setTimeout(() => {
        callback(Date.now())
      }, 0),
    )
    rs.stubGlobal('cancelAnimationFrame', (id: number): void => {
      window.clearTimeout(id)
    })
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

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('tracks a display:contents entry through its single rendered child', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-single-child-view'
    entry.style.display = 'contents'
    const child = document.createElement('section')
    entry.append(child)
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: child, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-single-child-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('tracks a multi-child display:contents entry from aggregate child visibility', async () => {
    const root = document.createElement('div')
    setRect(root, rect(0, 0, 300, 100))
    document.body.append(root)

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-aggregate-view'
    entry.style.display = 'contents'

    const first = document.createElement('div')
    const second = document.createElement('div')
    entry.append(first, second)
    root.append(entry)

    stubRangeRects(
      new Map<Element, DOMRect[]>([[entry, [rect(0, 180, 100, 60), rect(160, 20, 100, 60)]]]),
    )

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, root })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-aggregate-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('uses virtual aggregate tracking for text display:contents entries', async () => {
    const root = document.createElement('div')
    setRect(root, rect(0, 0, 300, 100))
    document.body.append(root)

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-text-view'
    entry.style.display = 'contents'
    entry.append('Plain text')
    root.append(entry)

    stubRangeRects(new Map<Element, DOMRect[]>([[entry, [rect(10, 10, 120, 20)]]]))

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, root })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-text-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('emits periodic and final updates for virtual aggregate entries', async () => {
    const root = document.createElement('div')
    setRect(root, rect(0, 0, 300, 100))
    document.body.append(root)

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-aggregate-duration'
    entry.style.display = 'contents'
    entry.append(document.createElement('div'), document.createElement('div'))
    root.append(entry)

    const rectsByElement = new Map<Element, DOMRect[]>([[entry, [rect(10, 10, 100, 40)]]])
    stubRangeRects(rectsByElement)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, root, viewDurationUpdateIntervalMs: 1000 })

    await advance(0)
    await advance(1000)

    rectsByElement.set(entry, [rect(10, 140, 100, 40)])
    document.dispatchEvent(new Event('scroll'))
    await advance(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(trackView).toHaveBeenCalledTimes(3)

    const firstPayload = trackView.mock.calls[0]?.[0]
    const secondPayload = trackView.mock.calls[1]?.[0]
    const finalPayload = trackView.mock.calls[2]?.[0]

    expect(firstPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-aggregate-duration',
        viewDurationMs: 0,
      }),
    )
    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-aggregate-duration',
        viewId: firstPayload?.viewId,
        viewDurationMs: 1000,
      }),
    )
    expect(finalPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-aggregate-duration',
        viewId: firstPayload?.viewId,
        viewDurationMs: 1000,
      }),
    )

    cleanup()
  })

  it('retargets display:contents entries after child mutations without duplicate tracking', async () => {
    const root = document.createElement('div')
    setRect(root, rect(0, 0, 300, 100))
    document.body.append(root)

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-retarget-view'
    entry.style.display = 'contents'

    const first = document.createElement('div')
    entry.append(first)
    root.append(entry)

    stubRangeRects(new Map<Element, DOMRect[]>([[entry, [rect(10, 10, 100, 40)]]]))

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, root })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    const second = document.createElement('div')
    entry.append(second)
    await Promise.resolve()
    await advance(0)

    instance.trigger({ target: first, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-retarget-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('prefers manual data when manually observing an element', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.enableElement(element, { data: { entryId: 'manual-view-entry' }, dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-view-entry',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('stops tracking after clearing a manual element override', async () => {
    const element = document.createElement('article')
    document.body.append(element)

    const { core, trackView } = createCore()
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

    expect(trackView).not.toHaveBeenCalled()

    cleanup()
  })

  it('stops tracking an auto-observed entry after explicit disable override', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-disabled'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })
    tracker.disableElement(entry)

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).not.toHaveBeenCalled()

    cleanup()
  })

  it('disables view tracking for auto-tracked entries via data-ctfl-track-views=false', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-disabled-by-data'
    entry.dataset.ctflTrackViews = 'false'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).not.toHaveBeenCalled()

    cleanup()
  })

  it('force-enables view tracking via data-ctfl-track-views=true when auto-tracking is disabled', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-auto-view-enabled-by-data'
    entry.dataset.ctflTrackViews = 'true'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.setAuto(false)
    tracker.start({ dwellTimeMs: 0 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(1)
    expect(trackView).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-auto-view-enabled-by-data',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )

    cleanup()
  })

  it('emits periodic duration updates while an observed entry remains visible', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-periodic-view'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 1000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await advance(1000)

    expect(trackView).toHaveBeenCalledTimes(2)

    const firstPayload = trackView.mock.calls[0]?.[0]
    const secondPayload = trackView.mock.calls[1]?.[0]

    expect(firstPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-view',
        viewId: expect.any(String),
        viewDurationMs: 0,
      }),
    )
    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-periodic-view',
        viewId: firstPayload?.viewId,
        viewDurationMs: 1000,
      }),
    )

    cleanup()
  })

  it('emits sticky only once per element across visibility cycles after success', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-sticky-once'
    entry.dataset.ctflSticky = 'true'
    document.body.append(entry)

    const stickySuccess = {}
    const trackView = rs.fn().mockResolvedValue({ accepted: true, data: stickySuccess })
    const core: EntryViewTrackingCore = { trackView }
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    instance.trigger({ target: entry, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()
    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(2)
    expect(trackView.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-sticky-once',
        sticky: true,
      }),
    )
    expect(trackView.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-sticky-once',
        sticky: undefined,
      }),
    )

    cleanup()
  })

  it('retries sticky for the same element until a successful optimization response', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-sticky-retry'
    entry.dataset.ctflSticky = 'true'
    document.body.append(entry)

    const stickySuccess = {}
    const trackView = rs
      .fn()
      .mockResolvedValueOnce({ accepted: false })
      .mockResolvedValueOnce({ accepted: true, data: stickySuccess })
      .mockResolvedValue({ accepted: true, data: stickySuccess })
    const core: EntryViewTrackingCore = { trackView }
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    instance.trigger({ target: entry, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()
    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    instance.trigger({ target: entry, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()
    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(3)
    expect(trackView.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-sticky-retry',
        sticky: true,
      }),
    )
    expect(trackView.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-sticky-retry',
        sticky: true,
      }),
    )
    expect(trackView.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-sticky-retry',
        sticky: undefined,
      }),
    )

    cleanup()
  })

  it('treats separately rendered elements as distinct sticky dedupe targets', async () => {
    const first = document.createElement('div')
    first.dataset.ctflEntryId = 'entry-shared-component-id'
    first.dataset.ctflSticky = 'true'
    document.body.append(first)

    const second = document.createElement('div')
    second.dataset.ctflEntryId = 'entry-shared-component-id'
    second.dataset.ctflSticky = 'true'
    document.body.append(second)

    const stickySuccess = {}
    const trackView = rs.fn().mockResolvedValue(stickySuccess)
    const core: EntryViewTrackingCore = { trackView }
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: first, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    instance.trigger({ target: second, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)

    expect(trackView).toHaveBeenCalledTimes(2)
    expect(trackView.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-shared-component-id',
        sticky: true,
      }),
    )
    expect(trackView.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        componentId: 'entry-shared-component-id',
        sticky: true,
      }),
    )

    cleanup()
  })

  it('emits a final duration update when an observed entry leaves view', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-view-final'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })
    await advance(0)
    await advance(500)
    instance.trigger({ target: entry, isIntersecting: false, intersectionRatio: 0 })
    await Promise.resolve()

    expect(trackView).toHaveBeenCalledTimes(2)

    const firstPayload = trackView.mock.calls[0]?.[0]
    const secondPayload = trackView.mock.calls[1]?.[0]

    expect(secondPayload).toEqual(
      expect.objectContaining({
        componentId: 'entry-view-final',
        viewId: firstPayload?.viewId,
        viewDurationMs: 500,
      }),
    )

    cleanup()
  })

  it('applies view-duration interval override from data attributes for auto-tracked entries', async () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-attr-interval'
    entry.dataset.ctflViewDurationUpdateIntervalMs = '250'
    document.body.append(entry)

    const { core, trackView } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryViewDetector(core))

    tracker.start({ dwellTimeMs: 0, viewDurationUpdateIntervalMs: 10_000 })

    const instance = io.getLast()

    if (!instance) {
      throw new Error('IntersectionObserver polyfill instance not found')
    }

    instance.trigger({ target: entry, isIntersecting: true, intersectionRatio: 1 })

    await advance(0)
    await advance(250)

    expect(trackView).toHaveBeenCalledTimes(2)

    cleanup()
  })

  it('applies view-duration interval override for manually enabled elements', async () => {
    const element = document.createElement('section')
    document.body.append(element)

    const { core, trackView } = createCore()
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

    expect(trackView).toHaveBeenCalledTimes(2)

    cleanup()
  })
})
