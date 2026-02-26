import type { EntryInteractionDetector } from './EntryInteractionTrackerHost'
import { EntryInteractionTrackerHost } from './EntryInteractionTrackerHost'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'

interface StartOptions {
  mode: 'auto' | 'manual'
}

interface ElementOptions {
  data?: unknown
}

function createHost(detector: EntryInteractionDetector<StartOptions, ElementOptions>): {
  host: EntryInteractionTrackerHost<StartOptions, ElementOptions>
  registry: EntryElementRegistry
  existenceObserver: ElementExistenceObserver
} {
  const existenceObserver = new ElementExistenceObserver()
  const registry = new EntryElementRegistry(existenceObserver)
  const host = new EntryInteractionTrackerHost(detector, registry)

  return { host, registry, existenceObserver }
}

describe('EntryInteractionTrackerHost', () => {
  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('starts detector and subscribes registry with detector callbacks', () => {
    const cleanup = rs.fn()
    const detector: EntryInteractionDetector<StartOptions, ElementOptions> = {
      start: rs.fn(),
      stop: rs.fn(),
      onEntryAdded: rs.fn(),
      onEntryRemoved: rs.fn(),
      onError: rs.fn(),
    }

    const { existenceObserver, host, registry } = createHost(detector)
    const subscribeSpy = rs.spyOn(registry, 'subscribe').mockImplementation(() => cleanup)

    const options: StartOptions = { mode: 'auto' }
    host.start(options)

    expect(detector.start).toHaveBeenCalledTimes(1)
    expect(detector.start).toHaveBeenCalledWith(options)
    expect(subscribeSpy).toHaveBeenCalledTimes(1)
    expect(subscribeSpy).toHaveBeenCalledWith({
      onAdded: detector.onEntryAdded,
      onRemoved: detector.onEntryRemoved,
      onError: detector.onError,
    })

    host.stop()
    registry.disconnect()
    existenceObserver.disconnect()
  })

  it('cleans up registry subscription once and always invokes detector stop', () => {
    const cleanup = rs.fn()
    const detector: EntryInteractionDetector<StartOptions, ElementOptions> = {
      start: rs.fn(),
      stop: rs.fn(),
    }

    const { existenceObserver, host, registry } = createHost(detector)
    rs.spyOn(registry, 'subscribe').mockImplementation(() => cleanup)

    host.start({ mode: 'manual' })
    host.stop()
    host.stop()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(detector.stop).toHaveBeenCalledTimes(2)

    registry.disconnect()
    existenceObserver.disconnect()
  })

  it('invokes detector stop even when start was never called', () => {
    const detector: EntryInteractionDetector<StartOptions, ElementOptions> = {
      start: rs.fn(),
      stop: rs.fn(),
    }

    const { existenceObserver, host, registry } = createHost(detector)

    host.stop()

    expect(detector.stop).toHaveBeenCalledTimes(1)

    registry.disconnect()
    existenceObserver.disconnect()
  })

  it('forwards track and untrack calls to detector when handlers exist', () => {
    const detector: EntryInteractionDetector<StartOptions, ElementOptions> = {
      start: rs.fn(),
      stop: rs.fn(),
      trackElement: rs.fn(),
      untrackElement: rs.fn(),
    }

    const { existenceObserver, host, registry } = createHost(detector)
    const element = document.createElement('div')
    const options: ElementOptions = { data: { entryId: 'entry-1' } }

    host.trackElement(element, options)
    host.untrackElement(element)

    expect(detector.trackElement).toHaveBeenCalledTimes(1)
    expect(detector.trackElement).toHaveBeenCalledWith(element, options)
    expect(detector.untrackElement).toHaveBeenCalledTimes(1)
    expect(detector.untrackElement).toHaveBeenCalledWith(element)

    registry.disconnect()
    existenceObserver.disconnect()
  })

  it('is a safe no-op for track and untrack when detector handlers are missing', () => {
    const detector: EntryInteractionDetector<StartOptions, ElementOptions> = {
      start: rs.fn(),
      stop: rs.fn(),
    }

    const { existenceObserver, host, registry } = createHost(detector)
    const element = document.createElement('div')

    expect(() => {
      host.trackElement(element, { data: { entryId: 'entry-2' } })
      host.untrackElement(element)
    }).not.toThrow()

    registry.disconnect()
    existenceObserver.disconnect()
  })
})
