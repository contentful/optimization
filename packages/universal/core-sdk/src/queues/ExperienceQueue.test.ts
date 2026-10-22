import type {
  ExperienceEventArray,
  OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import EventBuilder from '../events/EventBuilder'
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

const SAMPLE_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: profileFixture,
}

class ExperienceQueueTestHarness extends ExperienceQueue {
  async invokeUpsert(events: ExperienceEventArray): Promise<OptimizationData | undefined> {
    return await this.upsertProfile(events)
  }
}

interface BuildQueueOptions {
  upsertProfile?: (payload: {
    profileId?: string
    events: ExperienceEventArray
  }) => Promise<OptimizationData>
}

const buildQueue = ({ upsertProfile }: BuildQueueOptions = {}): {
  queue: ExperienceQueueTestHarness
  upsertProfile: ReturnType<typeof rs.fn>
} => {
  const upsertProfileMock =
    upsertProfile !== undefined
      ? rs.fn(upsertProfile)
      : rs.fn(async () => await Promise.resolve(SAMPLE_DATA))

  const queue = new ExperienceQueueTestHarness({
    experienceApi: { upsertProfile: upsertProfileMock },
    eventInterceptors: new InterceptorManager(),
    flushPolicy: resolveQueueFlushPolicy(undefined),
    getAnonymousId: () => undefined,
    offlineMaxEvents: 100,
    stateInterceptors: new InterceptorManager(),
  })

  return { queue, upsertProfile: upsertProfileMock }
}

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
  it('joins a queued flush until its transport settles', async () => {
    let complete!: (data: OptimizationData) => void
    const { queue, upsertProfile } = buildQueue({
      upsertProfile: async () =>
        await new Promise<OptimizationData>((resolve) => {
          complete = resolve
        }),
    })
    const builder = new EventBuilder({ channel: 'web', library: { name: 'test', version: '1' } })
    onlineSignal.value = false
    await queue.send(builder.buildPageView())
    const first = queue.flush({ force: true })
    let joined = false
    const second = queue.flush({ force: true }).then(() => {
      joined = true
    })
    await Promise.resolve()
    expect(joined).toBe(false)
    expect(upsertProfile).toHaveBeenCalledTimes(1)
    complete(SAMPLE_DATA)
    await Promise.all([first, second])
    expect(joined).toBe(true)
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })
  it('joins a flush requested by a pending-state subscriber before delivery starts', async () => {
    const response = Promise.withResolvers<OptimizationData>()
    const { queue, upsertProfile } = buildQueue({
      upsertProfile: async () => await response.promise,
    })
    const builder = new EventBuilder({ channel: 'web', library: { name: 'test', version: '1' } })
    onlineSignal.value = false
    await queue.send(builder.buildPageView())
    let joined = false
    let second: Promise<void> | undefined
    const unsubscribe = experienceRequestState.subscribe(({ status }) => {
      if (status !== 'pending') return
      second = queue.flush({ force: true }).then(() => {
        joined = true
      })
    })

    try {
      const first = queue.flush({ force: true })
      expect(upsertProfile).toHaveBeenCalledTimes(1)
      await Promise.resolve()
      expect(joined).toBe(false)
      response.resolve(SAMPLE_DATA)
      await first
      await second
      expect(joined).toBe(true)
      expect(upsertProfile).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  })

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
