import type { EntryInteractionDetector } from './EntryInteractionDetector'
import { EntryInteractionRuntime } from './EntryInteractionRuntime'
import * as clickDetectorModule from './events/click/createEntryClickDetector'
import * as hoverDetectorModule from './events/hover/createEntryHoverDetector'
import * as viewDetectorModule from './events/view/createEntryViewDetector'

interface DetectorMocks<
  TStartOptions = never,
  TElementOptions = never,
> extends EntryInteractionDetector<TStartOptions, TElementOptions> {
  start: ReturnType<typeof rs.fn>
  stop: ReturnType<typeof rs.fn>
  setAuto: ReturnType<typeof rs.fn>
  onEntryAdded: ReturnType<typeof rs.fn>
  onEntryRemoved: ReturnType<typeof rs.fn>
  onError: ReturnType<typeof rs.fn>
  enableElement: ReturnType<typeof rs.fn>
  disableElement: ReturnType<typeof rs.fn>
  clearElement: ReturnType<typeof rs.fn>
  flushActive: ReturnType<typeof rs.fn>
}

const createDetectorMocks = <TStartOptions, TElementOptions>(): DetectorMocks<
  TStartOptions,
  TElementOptions
> => ({
  start: rs.fn(),
  stop: rs.fn(),
  setAuto: rs.fn(),
  onEntryAdded: rs.fn(),
  onEntryRemoved: rs.fn(),
  onError: rs.fn(),
  enableElement: rs.fn(),
  disableElement: rs.fn(),
  clearElement: rs.fn(),
  flushActive: rs.fn(),
})

function createRuntime(
  autoTrack?: { clicks?: boolean; hovers?: boolean; views?: boolean },
  hasConsent: (name: string) => boolean = () => true,
): {
  runtime: EntryInteractionRuntime
  clickDetector: DetectorMocks<undefined, { data?: unknown }>
  hoverDetector: DetectorMocks<
    | {
        dwellTimeMs?: number
        hoverDurationUpdateIntervalMs?: number
      }
    | undefined,
    {
      data?: unknown
      dwellTimeMs?: number
      hoverDurationUpdateIntervalMs?: number
    }
  >
  viewDetector: DetectorMocks<
    | {
        dwellTimeMs?: number
        minVisibleRatio?: number
        viewDurationUpdateIntervalMs?: number
      }
    | undefined,
    {
      data?: unknown
      dwellTimeMs?: number
      viewDurationUpdateIntervalMs?: number
    }
  >
} {
  const core = {
    trackClick: rs.fn().mockResolvedValue(undefined),
    trackHover: rs.fn().mockResolvedValue(undefined),
    trackView: rs.fn().mockResolvedValue(undefined),
    hasConsent: rs.fn(hasConsent),
  }
  const clickDetector = createDetectorMocks<undefined, { data?: unknown }>()
  const hoverDetector = createDetectorMocks<
    | {
        dwellTimeMs?: number
        hoverDurationUpdateIntervalMs?: number
      }
    | undefined,
    { data?: unknown; dwellTimeMs?: number; hoverDurationUpdateIntervalMs?: number }
  >()
  const viewDetector = createDetectorMocks<
    | {
        dwellTimeMs?: number
        minVisibleRatio?: number
        viewDurationUpdateIntervalMs?: number
      }
    | undefined,
    { data?: unknown; dwellTimeMs?: number; viewDurationUpdateIntervalMs?: number }
  >()

  rs.spyOn(clickDetectorModule, 'createEntryClickDetector').mockReturnValue(clickDetector)
  rs.spyOn(hoverDetectorModule, 'createEntryHoverDetector').mockReturnValue(hoverDetector)
  rs.spyOn(viewDetectorModule, 'createEntryViewDetector').mockReturnValue(viewDetector)

  return {
    runtime: new EntryInteractionRuntime(core, autoTrack),
    clickDetector,
    hoverDetector,
    viewDetector,
  }
}

describe('EntryInteractionRuntime', () => {
  const isAutoTrackState = (
    value: unknown,
  ): value is Record<'clicks' | 'hovers' | 'views', boolean> => {
    if (!value || typeof value !== 'object') return false

    const clicks = Reflect.get(value, 'clicks')
    const hovers = Reflect.get(value, 'hovers')
    const views = Reflect.get(value, 'views')

    return typeof clicks === 'boolean' && typeof hovers === 'boolean' && typeof views === 'boolean'
  }

  const getAutoTrack = (
    runtime: EntryInteractionRuntime,
  ): Record<'clicks' | 'hovers' | 'views', boolean> => {
    const value = Reflect.get(runtime, 'autoTrack')

    if (!isAutoTrackState(value)) {
      throw new Error('Expected runtime auto-track state to be available')
    }

    return value
  }

  afterEach(() => {
    rs.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('enables interactions through tracking API and forwards start options', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('clicks')
    runtime.tracking.enable('views', { dwellTimeMs: 250, minVisibleRatio: 0.25 })
    runtime.tracking.enable('hovers', {
      dwellTimeMs: 100,
      hoverDurationUpdateIntervalMs: 2000,
    })

    expect(getAutoTrack(runtime).clicks).toBe(true)
    expect(getAutoTrack(runtime).hovers).toBe(true)
    expect(getAutoTrack(runtime).views).toBe(true)
    expect(clickDetector.setAuto).toHaveBeenCalledWith(true)
    expect(hoverDetector.setAuto).toHaveBeenCalledWith(true)
    expect(viewDetector.setAuto).toHaveBeenCalledWith(true)
    expect(clickDetector.start).toHaveBeenCalledWith()
    expect(hoverDetector.start).toHaveBeenCalledWith({
      dwellTimeMs: 100,
      hoverDurationUpdateIntervalMs: 2000,
    })
    expect(viewDetector.start).toHaveBeenCalledWith({
      dwellTimeMs: 250,
      minVisibleRatio: 0.25,
    })
  })

  it('seeds existing entry elements once per newly started detector', () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'seeded-entry'
    document.body.append(entry)
    const { clickDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('clicks')
    expect(clickDetector.onEntryAdded).toHaveBeenCalledTimes(1)
    expect(clickDetector.onEntryAdded).toHaveBeenCalledWith(entry)

    clickDetector.onEntryAdded.mockClear()
    runtime.tracking.enable('views')

    expect(clickDetector.onEntryAdded).not.toHaveBeenCalled()
    expect(viewDetector.onEntryAdded).toHaveBeenCalledTimes(1)
    expect(viewDetector.onEntryAdded).toHaveBeenCalledWith(entry)
  })

  it('ignores nested auto-tracked entries with the same baseline id', () => {
    const outer = document.createElement('div')
    outer.dataset.ctflBaselineId = 'baseline-entry'
    outer.dataset.ctflEntryId = 'variant-entry'
    const inner = document.createElement('div')
    inner.dataset.ctflBaselineId = 'baseline-entry'
    inner.dataset.ctflEntryId = 'baseline-entry'
    outer.append(inner)
    document.body.append(outer)
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')

    expect(viewDetector.onEntryAdded).toHaveBeenCalledTimes(1)
    expect(viewDetector.onEntryAdded).toHaveBeenCalledWith(outer)
  })

  it('fans entry DOM changes out to running detectors', async () => {
    const { clickDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('clicks')
    runtime.tracking.enable('views')
    clickDetector.onEntryAdded.mockClear()
    viewDetector.onEntryAdded.mockClear()

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'dynamic-entry'
    document.body.append(entry)

    await Promise.resolve()
    await Promise.resolve()

    expect(clickDetector.onEntryAdded).toHaveBeenCalledWith(entry)
    expect(viewDetector.onEntryAdded).toHaveBeenCalledWith(entry)

    document.body.removeChild(entry)

    await Promise.resolve()
    await Promise.resolve()

    expect(clickDetector.onEntryRemoved).toHaveBeenCalledWith(entry)
    expect(viewDetector.onEntryRemoved).toHaveBeenCalledWith(entry)
  })

  it('removes tracked descendants when a matching baseline ancestor becomes tracked', async () => {
    const outer = document.createElement('div')
    const inner = document.createElement('div')
    inner.dataset.ctflBaselineId = 'baseline-entry'
    inner.dataset.ctflEntryId = 'baseline-entry'
    outer.append(inner)
    document.body.append(outer)
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')
    expect(viewDetector.onEntryAdded).toHaveBeenCalledWith(inner)
    viewDetector.onEntryAdded.mockClear()

    outer.dataset.ctflBaselineId = 'baseline-entry'
    outer.dataset.ctflEntryId = 'variant-entry'

    await Promise.resolve()
    await Promise.resolve()

    expect(viewDetector.onEntryAdded).toHaveBeenCalledWith(outer)
    expect(viewDetector.onEntryRemoved).toHaveBeenCalledWith(inner)
  })

  it('disables interactions globally by setting their auto-track flag to false', () => {
    const { clickDetector, runtime } = createRuntime({ clicks: true })

    runtime.tracking.enable('clicks')
    runtime.tracking.disable('clicks')

    expect(getAutoTrack(runtime).clicks).toBe(false)
    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
  })

  it('forwards per-element override APIs to interaction trackers', () => {
    const { runtime, viewDetector } = createRuntime()
    const element = document.createElement('div')

    runtime.tracking.enable('views')
    runtime.tracking.enableElement('views', element, {
      data: { entryId: 'view-entry' },
      dwellTimeMs: 10,
    })
    runtime.tracking.disableElement('views', element)
    runtime.tracking.clearElement('views', element)

    expect(viewDetector.enableElement).toHaveBeenCalledWith(element, {
      data: { entryId: 'view-entry' },
      dwellTimeMs: 10,
    })
    expect(viewDetector.disableElement).toHaveBeenCalledWith(element)
    expect(viewDetector.clearElement).toHaveBeenCalledWith(element)
  })

  it('allows force-enabled elements to run when global auto-tracking is disabled', () => {
    const { clickDetector, runtime } = createRuntime({ clicks: false })
    const element = document.createElement('div')

    runtime.tracking.enableElement('clicks', element, { data: { entryId: 'entry-1' } })

    expect(clickDetector.start).toHaveBeenCalledTimes(1)
    expect(clickDetector.setAuto).toHaveBeenCalledWith(false)
  })

  it('stops force-enabled-only interactions after clearing the final override', () => {
    const { clickDetector, runtime } = createRuntime({ clicks: false })
    const element = document.createElement('div')

    runtime.tracking.enableElement('clicks', element, { data: { entryId: 'entry-1' } })
    runtime.tracking.clearElement('clicks', element)

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
  })

  it('syncs auto-tracked interactions with consent state', () => {
    let allowed = true
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime(
      {
        clicks: true,
        hovers: true,
        views: true,
      },
      () => allowed,
    )

    runtime.syncAutoTrackedEntryInteractions()
    expect(clickDetector.start).toHaveBeenCalledTimes(1)
    expect(hoverDetector.start).toHaveBeenCalledTimes(1)
    expect(viewDetector.start).toHaveBeenCalledTimes(1)

    allowed = false
    runtime.syncAutoTrackedEntryInteractions()
    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(hoverDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
  })

  it('keeps forced element interactions stopped until their event type is allowed', () => {
    let allowed = false
    const { clickDetector, runtime } = createRuntime(
      {
        clicks: false,
      },
      (name) => name !== 'trackClick' || allowed,
    )
    const element = document.createElement('div')

    runtime.tracking.enableElement('clicks', element, { data: { entryId: 'entry-1' } })
    expect(clickDetector.start).not.toHaveBeenCalled()

    allowed = true
    runtime.syncAutoTrackedEntryInteractions()
    expect(clickDetector.start).toHaveBeenCalledTimes(1)
    expect(clickDetector.setAuto).toHaveBeenCalledWith(false)
  })

  it('does not start or stop interactions when auto-tracking is disabled', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime({
      clicks: false,
      hovers: false,
      views: false,
    })

    runtime.syncAutoTrackedEntryInteractions()
    runtime.syncAutoTrackedEntryInteractions()

    expect(clickDetector.start).not.toHaveBeenCalled()
    expect(hoverDetector.start).not.toHaveBeenCalled()
    expect(viewDetector.start).not.toHaveBeenCalled()
    expect(clickDetector.stop).not.toHaveBeenCalled()
    expect(hoverDetector.stop).not.toHaveBeenCalled()
    expect(viewDetector.stop).not.toHaveBeenCalled()
  })

  it('restarts an interaction when re-enabled with new start options', () => {
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views', { dwellTimeMs: 50 })
    runtime.tracking.enable('views', { dwellTimeMs: 100 })

    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.start).toHaveBeenCalledTimes(2)
    expect(viewDetector.start).toHaveBeenNthCalledWith(2, { dwellTimeMs: 100 })
  })

  it('reset stops all interaction trackers and clears element overrides', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime({ clicks: false })
    const element = document.createElement('div')

    runtime.tracking.enableElement('clicks', element, { data: { entryId: 'entry-reset' } })
    runtime.reset()
    runtime.tracking.clearElement('clicks', element)

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(hoverDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(clickDetector.clearElement).not.toHaveBeenCalled()
  })

  it('destroy stops trackers and clears entry observation state', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime()
    runtime.tracking.enable('clicks')

    runtime.destroy()

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(hoverDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(Reflect.get(runtime, 'entryElementObserver')).toBeUndefined()
  })

  it('flushActiveInteractions asks running view and hover detectors to flush', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')
    runtime.tracking.enable('hovers')

    runtime.flushActiveInteractions()

    expect(viewDetector.flushActive).toHaveBeenCalledTimes(1)
    expect(hoverDetector.flushActive).toHaveBeenCalledTimes(1)
    expect(clickDetector.flushActive).not.toHaveBeenCalled()
  })

  it('flushActiveInteractions skips detectors that are not running', () => {
    const { hoverDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')

    runtime.flushActiveInteractions()

    expect(viewDetector.flushActive).toHaveBeenCalledTimes(1)
    expect(hoverDetector.flushActive).not.toHaveBeenCalled()
  })
})
