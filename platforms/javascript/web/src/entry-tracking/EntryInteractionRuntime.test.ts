import * as clickDetectorModule from './click/createEntryClickDetector'
import type { EntryInteractionDetector } from './EntryInteractionDetector'
import { EntryInteractionRuntime } from './EntryInteractionRuntime'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'
import * as viewDetectorModule from './view/createEntryViewDetector'

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

function createRuntime(autoTrack?: { clicks?: boolean; views?: boolean }): {
  runtime: EntryInteractionRuntime
  clickDetector: DetectorMocks<undefined, { data?: unknown }>
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
    trackComponentView: rs.fn().mockResolvedValue(undefined),
  }
  const clickDetector = createDetectorMocks<undefined, { data?: unknown }>()
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
  rs.spyOn(viewDetectorModule, 'createEntryViewDetector').mockReturnValue(viewDetector)

  return {
    runtime: new EntryInteractionRuntime(core, autoTrack),
    clickDetector,
    viewDetector,
  }
}

describe('EntryInteractionRuntime', () => {
  const isAutoTrackState = (value: unknown): value is Record<'clicks' | 'views', boolean> => {
    if (!value || typeof value !== 'object') return false

    const clicks = Reflect.get(value, 'clicks')
    const views = Reflect.get(value, 'views')

    return typeof clicks === 'boolean' && typeof views === 'boolean'
  }

  const getAutoTrack = (runtime: EntryInteractionRuntime): Record<'clicks' | 'views', boolean> => {
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
    const { clickDetector, runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('clicks')
    runtime.tracking.enable('views', { dwellTimeMs: 250, minVisibleRatio: 0.25 })

    expect(getAutoTrack(runtime).clicks).toBe(true)
    expect(getAutoTrack(runtime).views).toBe(true)
    expect(clickDetector.setAuto).toHaveBeenCalledWith(true)
    expect(viewDetector.setAuto).toHaveBeenCalledWith(true)
    expect(clickDetector.start).toHaveBeenCalledWith()
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
    const { clickDetector, runtime, viewDetector } = createRuntime({ clicks: true, views: true })

    runtime.syncAutoTrackedEntryInteractions(true)
    expect(clickDetector.start).toHaveBeenCalledTimes(1)
    expect(viewDetector.start).toHaveBeenCalledTimes(1)

    runtime.syncAutoTrackedEntryInteractions(false)
    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
  })

  it('does not start or stop interactions when auto-tracking is disabled', () => {
    const { clickDetector, runtime, viewDetector } = createRuntime({ clicks: false, views: false })

    runtime.syncAutoTrackedEntryInteractions(true)
    runtime.syncAutoTrackedEntryInteractions(false)

    expect(clickDetector.start).not.toHaveBeenCalled()
    expect(viewDetector.start).not.toHaveBeenCalled()
    expect(clickDetector.stop).not.toHaveBeenCalled()
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
    const { clickDetector, runtime, viewDetector } = createRuntime({ clicks: false })
    const element = document.createElement('div')

    runtime.tracking.enableElement('clicks', element, { data: { entryId: 'entry-reset' } })
    runtime.reset()
    runtime.tracking.clearElement('clicks', element)

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(clickDetector.clearElement).not.toHaveBeenCalled()
  })

  it('destroy stops trackers and disconnects shared registry and observer', () => {
    const { clickDetector, runtime, viewDetector } = createRuntime()
    const registryDisconnectSpy = rs
      .spyOn(EntryElementRegistry.prototype, 'disconnect')
      .mockImplementation(() => undefined)
    const observerDisconnectSpy = rs
      .spyOn(ElementExistenceObserver.prototype, 'disconnect')
      .mockImplementation(() => undefined)

    runtime.destroy()

    expect(clickDetector.stop).toHaveBeenCalledTimes(1)
    expect(viewDetector.stop).toHaveBeenCalledTimes(1)
    expect(registryDisconnectSpy).toHaveBeenCalledTimes(1)
    expect(observerDisconnectSpy).toHaveBeenCalledTimes(1)
  })
})
