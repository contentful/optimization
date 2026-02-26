import { EntryInteractionRuntime } from './EntryInteractionRuntime'
import { EntryInteractionTrackerHost } from './EntryInteractionTrackerHost'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'

function createRuntime(autoTrack?: { clicks?: boolean; views?: boolean }): EntryInteractionRuntime {
  const core = {
    trackComponentClick: rs.fn().mockResolvedValue(undefined),
    trackComponentView: rs.fn().mockResolvedValue(undefined),
  }

  return new EntryInteractionRuntime(core, autoTrack)
}

describe('EntryInteractionRuntime', () => {
  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('enables interactions through tracking API and forwards start options', () => {
    const startSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'start')
      .mockImplementation(() => undefined)
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)

    const runtime = createRuntime()

    runtime.tracking.enable('clicks')
    runtime.tracking.enable('views', { dwellTimeMs: 250, minVisibleRatio: 0.25 })

    expect(runtime.autoTrackEntryInteractions.clicks).toBe(true)
    expect(runtime.autoTrackEntryInteractions.views).toBe(true)
    expect(stopSpy).toHaveBeenCalledTimes(2)
    expect(startSpy).toHaveBeenCalledTimes(2)
    expect(startSpy).toHaveBeenNthCalledWith(1)
    expect(startSpy).toHaveBeenNthCalledWith(2, {
      dwellTimeMs: 250,
      minVisibleRatio: 0.25,
    })
  })

  it('forwards observe and unobserve to the respective interaction tracker', () => {
    const trackSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'trackElement')
      .mockImplementation(() => undefined)
    const untrackSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'untrackElement')
      .mockImplementation(() => undefined)
    const runtime = createRuntime()
    const element = document.createElement('div')

    runtime.tracking.observe('clicks', element, { data: { entryId: 'click-entry' } })
    runtime.tracking.observe('views', element, {
      data: { entryId: 'view-entry' },
      dwellTimeMs: 10,
    })
    runtime.tracking.unobserve('clicks', element)
    runtime.tracking.unobserve('views', element)

    expect(trackSpy).toHaveBeenCalledTimes(2)
    expect(trackSpy).toHaveBeenNthCalledWith(1, element, { data: { entryId: 'click-entry' } })
    expect(trackSpy).toHaveBeenNthCalledWith(2, element, {
      data: { entryId: 'view-entry' },
      dwellTimeMs: 10,
    })
    expect(untrackSpy).toHaveBeenCalledTimes(2)
    expect(untrackSpy).toHaveBeenNthCalledWith(1, element)
    expect(untrackSpy).toHaveBeenNthCalledWith(2, element)
  })

  it('syncs auto-tracked interactions with consent state', () => {
    const startSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'start')
      .mockImplementation(() => undefined)
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)
    const runtime = createRuntime({ clicks: true, views: true })

    runtime.syncAutoTrackedEntryInteractions(true)
    expect(startSpy).toHaveBeenCalledTimes(2)
    expect(stopSpy).toHaveBeenCalledTimes(2)

    runtime.syncAutoTrackedEntryInteractions(false)
    expect(startSpy).toHaveBeenCalledTimes(2)
    expect(stopSpy).toHaveBeenCalledTimes(4)
  })

  it('does not start or stop interactions when auto-tracking is disabled', () => {
    const startSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'start')
      .mockImplementation(() => undefined)
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)
    const runtime = createRuntime({ clicks: false, views: false })

    runtime.syncAutoTrackedEntryInteractions(true)
    runtime.syncAutoTrackedEntryInteractions(false)

    expect(startSpy).not.toHaveBeenCalled()
    expect(stopSpy).not.toHaveBeenCalled()
  })

  it('disables a single interaction through tracking API', () => {
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)
    const runtime = createRuntime()

    runtime.tracking.disable('clicks')

    expect(stopSpy).toHaveBeenCalledTimes(1)
  })

  it('reset stops all interaction trackers', () => {
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)
    const runtime = createRuntime()

    runtime.reset()

    expect(stopSpy).toHaveBeenCalledTimes(2)
  })

  it('destroy stops trackers and disconnects shared registry and observer', () => {
    const stopSpy = rs
      .spyOn(EntryInteractionTrackerHost.prototype, 'stop')
      .mockImplementation(() => undefined)
    const registryDisconnectSpy = rs
      .spyOn(EntryElementRegistry.prototype, 'disconnect')
      .mockImplementation(() => undefined)
    const observerDisconnectSpy = rs
      .spyOn(ElementExistenceObserver.prototype, 'disconnect')
      .mockImplementation(() => undefined)
    const runtime = createRuntime()

    runtime.destroy()

    expect(stopSpy).toHaveBeenCalledTimes(2)
    expect(registryDisconnectSpy).toHaveBeenCalledTimes(1)
    expect(observerDisconnectSpy).toHaveBeenCalledTimes(1)
  })
})
