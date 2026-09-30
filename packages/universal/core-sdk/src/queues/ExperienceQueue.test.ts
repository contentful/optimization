import type {
  ExperienceEvent,
  ExperienceEventArray,
  OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import type { LifecycleInterceptors } from '../CoreBase'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import {
  experienceRequestState,
  online as onlineSignal,
  selectedOptimizations as selectedOptimizationsSignal,
  type ExperienceRequestState,
} from '../signals'
import { profile as profileFixture } from '../test/fixtures/profile'
import { ExperienceQueue } from './ExperienceQueue'

type InterceptedEvent = Parameters<LifecycleInterceptors['event']['add']>[0] extends (
  value: Readonly<infer T>,
) => unknown
  ? T
  : never

const SAMPLE_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: profileFixture,
}

class ExperienceQueueTestHarness extends ExperienceQueue {
  async invokeUpsert(events: ExperienceEventArray): Promise<OptimizationData> {
    return await this.upsertProfile(events)
  }
}

interface BuildQueueOptions {
  eventInterceptors?: LifecycleInterceptors['event']
  upsertProfile?: (payload: {
    profileId?: string
    events: ExperienceEventArray
  }) => Promise<OptimizationData>
  offlineMaxEvents?: number
}

const buildQueue = ({
  eventInterceptors = new InterceptorManager<InterceptedEvent>(),
  offlineMaxEvents = 100,
  upsertProfile,
}: BuildQueueOptions = {}): {
  queue: ExperienceQueueTestHarness
  upsertProfile: ReturnType<typeof rs.fn>
} => {
  const upsertProfileMock =
    upsertProfile !== undefined
      ? rs.fn(upsertProfile)
      : rs.fn(async () => await Promise.resolve(SAMPLE_DATA))

  const queue = new ExperienceQueueTestHarness({
    experienceApi: { upsertProfile: upsertProfileMock },
    eventInterceptors,
    flushPolicy: resolveQueueFlushPolicy(undefined),
    getAnonymousId: () => undefined,
    offlineMaxEvents,
    stateInterceptors: new InterceptorManager(),
  })

  return { queue, upsertProfile: upsertProfileMock }
}

const makeTrackEvent = (event: string): ExperienceEvent => ({
  channel: 'web',
  context: {
    app: { name: 'test-app', version: '1.0.0' },
    campaign: {},
    gdpr: { isConsentGiven: true },
    library: { name: 'test-lib', version: '1.0.0' },
    locale: 'en-US',
  },
  event,
  messageId: crypto.randomUUID(),
  originalTimestamp: '2026-01-01T00:00:00.000Z',
  properties: {
    path: '/',
    query: {},
    referrer: '',
    search: '',
    title: '',
    url: 'https://example.test/',
  },
  sentAt: '2026-01-01T00:00:00.000Z',
  timestamp: '2026-01-01T00:00:00.000Z',
  type: 'track',
})

const makePageEvent = (): ExperienceEvent => ({
  channel: 'web',
  context: {
    app: { name: 'test-app', version: '1.0.0' },
    campaign: {},
    gdpr: { isConsentGiven: true },
    library: { name: 'test-lib', version: '1.0.0' },
    locale: 'en-US',
    page: {
      path: '/',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: 'https://example.test/',
    },
  },
  messageId: crypto.randomUUID(),
  originalTimestamp: '2026-01-01T00:00:00.000Z',
  properties: {
    path: '/',
    query: {},
    referrer: '',
    search: '',
    title: '',
    url: 'https://example.test/',
  },
  sentAt: '2026-01-01T00:00:00.000Z',
  timestamp: '2026-01-01T00:00:00.000Z',
  type: 'page',
})

const observeRequestState = (): {
  states: ExperienceRequestState[]
  unsubscribe: () => void
} => {
  const states: ExperienceRequestState[] = []
  const unsubscribe = experienceRequestState.subscribe((value) => {
    states.push(value)
  })
  return { states, unsubscribe }
}

describe('ExperienceQueue.experienceRequestState transitions', () => {
  beforeEach(() => {
    experienceRequestState.value = { status: 'idle' }
    onlineSignal.value = true
    selectedOptimizationsSignal.value = undefined
  })

  afterEach(() => {
    experienceRequestState.value = { status: 'idle' }
    selectedOptimizationsSignal.value = undefined
  })

  it('starts in the idle state', () => {
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
  })

  it('transitions pending -> success around a successful upsert', async () => {
    const { queue } = buildQueue()
    const { states, unsubscribe } = observeRequestState()

    await queue.invokeUpsert([])

    expect(states).toEqual([{ status: 'idle' }, { status: 'pending' }, { status: 'success' }])
    expect(experienceRequestState.value).toEqual({ status: 'success' })

    unsubscribe()
  })

  it('transitions pending -> failed:timeout when the request aborts', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    const { queue } = buildQueue({
      upsertProfile: async () => {
        await Promise.resolve()
        throw abortError
      },
    })
    const { states, unsubscribe } = observeRequestState()

    await expect(queue.invokeUpsert([])).rejects.toBe(abortError)

    expect(states).toEqual([
      { status: 'idle' },
      { status: 'pending' },
      { status: 'failed', reason: 'timeout' },
    ])
    expect(experienceRequestState.value).toEqual({ status: 'failed', reason: 'timeout' })

    unsubscribe()
  })

  it('transitions pending -> failed:api-error for non-abort failures', async () => {
    const { queue } = buildQueue({
      upsertProfile: async () => {
        await Promise.resolve()
        throw new Error('500 Internal Server Error')
      },
    })
    const { states, unsubscribe } = observeRequestState()

    await expect(queue.invokeUpsert([])).rejects.toThrow('500 Internal Server Error')

    expect(states.at(-1)).toEqual({ status: 'failed', reason: 'api-error' })

    unsubscribe()
  })

  it('overwrites a terminal failed state with pending on the next request', async () => {
    let attempt = 0
    const { queue } = buildQueue({
      upsertProfile: async () => {
        await Promise.resolve()
        attempt += 1
        if (attempt === 1) throw new Error('boom')
        return SAMPLE_DATA
      },
    })

    await expect(queue.invokeUpsert([])).rejects.toThrow('boom')
    expect(experienceRequestState.value).toEqual({ status: 'failed', reason: 'api-error' })

    const { states, unsubscribe } = observeRequestState()

    await queue.invokeUpsert([])

    expect(states).toEqual([
      { status: 'failed', reason: 'api-error' },
      { status: 'pending' },
      { status: 'success' },
    ])

    unsubscribe()
  })
})

describe('ExperienceQueue batches', () => {
  beforeEach(() => {
    onlineSignal.value = true
  })

  it('intercepts and sends a batch once', async () => {
    const eventInterceptors = new InterceptorManager<InterceptedEvent>()
    const interceptedTypes: string[] = []
    eventInterceptors.add((event) => {
      interceptedTypes.push(event.type)
      return event
    })
    const { queue, upsertProfile } = buildQueue({ eventInterceptors })

    await queue.sendBatch([makeTrackEvent('first'), makePageEvent()])

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(interceptedTypes).toEqual(['track', 'page'])
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ event: 'first' }),
          expect.objectContaining({ type: 'page' }),
        ]),
      }),
    )
  })

  it('rejects an overflowing batch without queueing a partial batch', async () => {
    const { queue, upsertProfile } = buildQueue({ offlineMaxEvents: 1 })
    onlineSignal.value = false

    await expect(queue.sendBatch([makeTrackEvent('first'), makePageEvent()])).rejects.toThrow(
      'Experience batch exceeds offline queue capacity',
    )

    onlineSignal.value = true
    await queue.flush({ force: true })
    expect(upsertProfile).not.toHaveBeenCalled()
  })
})
