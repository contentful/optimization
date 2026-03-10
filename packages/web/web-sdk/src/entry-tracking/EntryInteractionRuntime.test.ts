import type { EntryInteractionDetector } from './EntryInteractionDetector'
import { EntryInteractionRuntime } from './EntryInteractionRuntime'
import * as clickDetectorModule from './events/click/createEntryClickDetector'
import * as hoverDetectorModule from './events/hover/createEntryHoverDetector'
import * as viewDetectorModule from './events/view/createEntryViewDetector'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'

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
})

function createRuntime(autoTrack?: { clicks?: boolean; hovers?: boolean; views?: boolean }): {
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
    trackComponentClick: rs.fn().mockResolvedValue(undefined),
    trackHover: rs.fn().mockResolvedValue(undefined),
    trackView: rs.fn().mockResolvedValue(undefined),
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
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime({
      clicks: true,
      hovers: true,
      views: true,
    })

    runtime.syncAutoTrackedEntryInteractions(true)
    expect(clickDetector.start).toHaveBeenCalledTimes(1)
    expect(hoverDetector.start).toHaveBeenCalledTimes(1)
    expect(viewDetector.start).toHaveBeenCalledTimes(1)

    runtime.syncAutoTrackedEntryInteractions(false)
    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(hoverDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
  })

  it('does not start or stop interactions when auto-tracking is disabled', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime({
      clicks: false,
      hovers: false,
      views: false,
    })

    runtime.syncAutoTrackedEntryInteractions(true)
    runtime.syncAutoTrackedEntryInteractions(false)

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

  it('destroy stops trackers and disconnects shared registry and observer', () => {
    const { clickDetector, hoverDetector, runtime, viewDetector } = createRuntime()
    const registryDisconnectSpy = rs
      .spyOn(EntryElementRegistry.prototype, 'disconnect')
      .mockImplementation(() => undefined)
    const observerDisconnectSpy = rs
      .spyOn(ElementExistenceObserver.prototype, 'disconnect')
      .mockImplementation(() => undefined)

    runtime.destroy()

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(hoverDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(registryDisconnectSpy).toHaveBeenCalledTimes(1)
    expect(observerDisconnectSpy).toHaveBeenCalledTimes(1)
  })
})
