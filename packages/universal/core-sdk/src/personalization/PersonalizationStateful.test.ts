import { ApiClient } from '@contentful/optimization-api-client'
import type {
  ChangeArray,
  ExperienceEventArray,
  OptimizationData,
  Profile,
} from '@contentful/optimization-api-client/api-schemas'
import type { LifecycleInterceptors } from '../CoreBase'
import { EventBuilder } from '../events'
import { InterceptorManager } from '../lib/interceptor'
import type { QueueFlushFailureContext, QueueFlushRecoveredContext } from '../lib/queue'
import { batch, changes as changesSignal, consent, online, profile } from '../signals'
import PersonalizationStateful, {
  type PersonalizationOfflineQueueDropContext,
  type PersonalizationQueuePolicy,
} from './PersonalizationStateful'

interface CreatePersonalizationOptions {
  queuePolicy?: PersonalizationQueuePolicy
  upsertProfile?: ApiClient['experience']['upsertProfile']
}

const DEFAULT_PROFILE: Profile = {
  id: 'profile-id',
  stableId: 'profile-id',
  random: 1,
  audiences: [],
  traits: {},
  location: {},
  session: {
    id: 'session-id',
    isReturningVisitor: false,
    landingPage: {
      path: '/',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: 'https://example.test/',
    },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  },
}

const EMPTY_OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedPersonalizations: [],
  profile: DEFAULT_PROFILE,
}

const createPersonalization = (
  options: CreatePersonalizationOptions = {},
): PersonalizationStateful => {
  const { queuePolicy } = options
  const upsertProfile =
    options.upsertProfile ??
    rs.fn<ApiClient['experience']['upsertProfile']>().mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
  const api = new ApiClient({
    clientId: 'key_123',
    environment: 'main',
  })
  rs.spyOn(api.experience, 'upsertProfile').mockImplementation(upsertProfile)

  const builder = new EventBuilder({
    channel: 'web',
    library: {
      name: 'Optimization Core Tests',
      version: '0.0.0',
    },
  })

  const interceptors: LifecycleInterceptors = {
    event: new InterceptorManager(),
    state: new InterceptorManager(),
  }

  return new PersonalizationStateful({
    api,
    eventBuilder: builder,
    interceptors,
    config: {
      defaults: {
        profile: DEFAULT_PROFILE,
      },
      queuePolicy,
    },
  })
}

const getOfflineQueue = (personalization: PersonalizationStateful): Set<unknown> => {
  const queue = Reflect.get(personalization, 'offlineQueue')

  if (!(queue instanceof Set)) {
    throw new TypeError('Expected PersonalizationStateful.offlineQueue to be a Set')
  }

  return queue
}

const getTrackNamesFromQueue = (queue: Set<unknown>): string[] => {
  const names: string[] = []

  queue.forEach((event) => {
    if (typeof event !== 'object' || event === null) return

    const type = Reflect.get(event, 'type')
    const name = Reflect.get(event, 'event')

    if (type === 'track' && typeof name === 'string') names.push(name)
  })

  return names
}

const getTrackNamesFromEvents = (events: ExperienceEventArray): string[] =>
  events.flatMap((event) => (event.type === 'track' ? [event.event] : []))

const enqueueOfflineTrackEvent = (
  personalization: PersonalizationStateful,
  event: string,
): void => {
  const enqueueOfflineEventValue: unknown = Reflect.get(personalization, 'enqueueOfflineEvent')
  const builderValue: unknown = Reflect.get(personalization, 'eventBuilder')

  if (typeof enqueueOfflineEventValue !== 'function') {
    throw new TypeError(
      'Expected PersonalizationStateful.enqueueOfflineEvent to be a callable function',
    )
  }

  if (!(builderValue instanceof EventBuilder)) {
    throw new TypeError(
      'Expected PersonalizationStateful.eventBuilder to be an EventBuilder instance',
    )
  }

  const trackEvent = builderValue.buildTrack({ event })

  Reflect.apply(enqueueOfflineEventValue, personalization, [trackEvent])
}

describe('PersonalizationStateful offline queue policy', () => {
  beforeEach(() => {
    batch(() => {
      consent.value = true
      online.value = false
      profile.value = undefined
    })

    rs.useFakeTimers()
  })

  afterEach(() => {
    rs.clearAllTimers()
    rs.restoreAllMocks()
    rs.useRealTimers()
  })

  it('drops oldest events when queue exceeds maxEvents', async () => {
    const personalization = createPersonalization({
      queuePolicy: {
        maxEvents: 3,
      },
    })

    await personalization.track({ event: 'e1' })
    await personalization.track({ event: 'e2' })
    await personalization.track({ event: 'e3' })
    await personalization.track({ event: 'e4' })
    await personalization.track({ event: 'e5' })

    const queue = getOfflineQueue(personalization)

    expect(queue.size).toBe(3)
    expect(getTrackNamesFromQueue(queue)).toEqual(['e3', 'e4', 'e5'])
  })

  it('emits queue drop telemetry callback when events are dropped', async () => {
    const onDrop = rs.fn<(context: PersonalizationOfflineQueueDropContext) => void>()
    const personalization = createPersonalization({
      queuePolicy: {
        maxEvents: 2,
        onDrop,
      },
    })

    await personalization.track({ event: 'e1' })
    await personalization.track({ event: 'e2' })
    await personalization.track({ event: 'e3' })

    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        droppedCount: 1,
        maxEvents: 2,
        queuedEvents: 2,
      }),
    )

    const droppedEvents = onDrop.mock.calls[0]?.[0].droppedEvents

    if (!droppedEvents) throw new TypeError('Expected onDrop callback to receive dropped events')

    expect(getTrackNamesFromEvents(droppedEvents)).toEqual(['e1'])
  })

  it('swallows queue drop callback failures', async () => {
    const onDrop = rs
      .fn<(context: PersonalizationOfflineQueueDropContext) => void>()
      .mockImplementation(() => {
        throw new Error('telemetry-down')
      })
    const personalization = createPersonalization({
      queuePolicy: {
        maxEvents: 2,
        onDrop,
      },
    })

    await personalization.track({ event: 'e1' })
    await personalization.track({ event: 'e2' })

    await expect(personalization.track({ event: 'e3' })).resolves.toBeUndefined()
    expect(onDrop).toHaveBeenCalledTimes(1)
  })

  it('flushes retained events after oldest events are dropped', async () => {
    const sentEvents: ExperienceEventArray[] = []
    const upsertProfile = rs
      .fn<ApiClient['experience']['upsertProfile']>()
      .mockImplementation(async ({ events }) => {
        sentEvents.push(events)
        await Promise.resolve()
        return EMPTY_OPTIMIZATION_DATA
      })
    const personalization = createPersonalization({
      upsertProfile,
      queuePolicy: {
        maxEvents: 2,
      },
    })

    await personalization.track({ event: 'e1' })
    await personalization.track({ event: 'e2' })
    await personalization.track({ event: 'e3' })
    await personalization.track({ event: 'e4' })

    await personalization.flush({ force: true })

    expect(sentEvents).toHaveLength(1)
    expect(getTrackNamesFromEvents(sentEvents[0] ?? [])).toEqual(['e3', 'e4'])
    expect(getOfflineQueue(personalization).size).toBe(0)
  })

  it('retries failed offline queue flushes with backoff and clears the queue after recovery', async () => {
    const upsertProfile = rs
      .fn<ApiClient['experience']['upsertProfile']>()
      .mockRejectedValueOnce(new Error('network-down'))
      .mockRejectedValueOnce(new Error('still-down'))
      .mockResolvedValueOnce(EMPTY_OPTIMIZATION_DATA)
    const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
    const onFlushRecovered = rs.fn<(context: QueueFlushRecoveredContext) => void>()
    batch(() => {
      online.value = true
    })

    const personalization = createPersonalization({
      upsertProfile,
      queuePolicy: {
        flushPolicy: {
          baseBackoffMs: 20,
          maxBackoffMs: 20,
          jitterRatio: 0,
          maxConsecutiveFailures: 5,
          circuitOpenMs: 200,
          onFlushFailure,
          onFlushRecovered,
        },
      },
    })

    enqueueOfflineTrackEvent(personalization, 'e1')

    await personalization.flush()

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(onFlushFailure).toHaveBeenCalledTimes(1)
    expect(onFlushFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 1,
        queuedBatches: 1,
        queuedEvents: 1,
        retryDelayMs: 20,
      }),
    )
    expect(getOfflineQueue(personalization).size).toBe(1)

    await rs.advanceTimersByTimeAsync(20)

    expect(upsertProfile).toHaveBeenCalledTimes(2)
    expect(onFlushFailure).toHaveBeenCalledTimes(2)
    expect(getOfflineQueue(personalization).size).toBe(1)

    await rs.advanceTimersByTimeAsync(20)

    expect(upsertProfile).toHaveBeenCalledTimes(3)
    expect(onFlushRecovered).toHaveBeenCalledTimes(1)
    expect(onFlushRecovered).toHaveBeenCalledWith({ consecutiveFailures: 2 })
    expect(getOfflineQueue(personalization).size).toBe(0)
  })

  it('opens a circuit window after repeated offline flush failures', async () => {
    const upsertProfile = rs
      .fn<ApiClient['experience']['upsertProfile']>()
      .mockRejectedValue(new Error('network-down'))
    const onCircuitOpen = rs.fn<(context: QueueFlushFailureContext) => void>()
    batch(() => {
      online.value = true
    })

    const personalization = createPersonalization({
      upsertProfile,
      queuePolicy: {
        flushPolicy: {
          baseBackoffMs: 5,
          maxBackoffMs: 5,
          jitterRatio: 0,
          maxConsecutiveFailures: 2,
          circuitOpenMs: 50,
          onCircuitOpen,
        },
      },
    })

    enqueueOfflineTrackEvent(personalization, 'e1')

    await personalization.flush()

    expect(upsertProfile).toHaveBeenCalledTimes(1)

    await rs.advanceTimersByTimeAsync(5)

    expect(upsertProfile).toHaveBeenCalledTimes(2)
    expect(onCircuitOpen).toHaveBeenCalledTimes(1)
    expect(onCircuitOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 2,
        queuedBatches: 1,
        queuedEvents: 1,
        retryDelayMs: 50,
      }),
    )
    expect(getOfflineQueue(personalization).size).toBe(1)

    await rs.advanceTimersByTimeAsync(49)
    expect(upsertProfile).toHaveBeenCalledTimes(2)

    await rs.advanceTimersByTimeAsync(1)
    expect(upsertProfile).toHaveBeenCalledTimes(3)
  })

  it('does not queue online personalization events when immediate delivery fails', async () => {
    const upsertProfile = rs
      .fn<ApiClient['experience']['upsertProfile']>()
      .mockRejectedValue(new Error('network-down'))
    const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
    const personalization = createPersonalization({
      upsertProfile,
      queuePolicy: {
        flushPolicy: {
          onFlushFailure,
        },
      },
    })

    batch(() => {
      online.value = true
    })
    await rs.advanceTimersByTimeAsync(0)

    await expect(personalization.track({ event: 'e1' })).rejects.toThrow('network-down')

    expect(getOfflineQueue(personalization).size).toBe(0)
    expect(onFlushFailure).not.toHaveBeenCalled()
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })
})

const CHANGES: ChangeArray = [
  {
    key: 'dark-mode',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 0,
    },
  },
  {
    key: 'config',
    type: 'Variable',
    value: {
      value: {
        amount: 10,
        currency: 'USD',
      },
    },
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

describe('PersonalizationStateful custom flags', () => {
  beforeEach(() => {
    batch(() => {
      changesSignal.value = undefined
    })
  })

  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('resolves all custom flags from provided changes', () => {
    const personalization = createPersonalization()

    expect(personalization.getCustomFlags(CHANGES)).toEqual({
      'dark-mode': true,
      config: {
        amount: 10,
        currency: 'USD',
      },
    })
  })

  it('uses signal changes by default when resolving all custom flags', () => {
    const personalization = createPersonalization()

    batch(() => {
      changesSignal.value = CHANGES
    })

    expect(personalization.getCustomFlags()).toEqual({
      'dark-mode': true,
      config: {
        amount: 10,
        currency: 'USD',
      },
    })
  })
})
