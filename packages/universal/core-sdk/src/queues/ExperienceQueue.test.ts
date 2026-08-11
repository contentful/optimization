import type {
  ExperienceEventArray,
  OptimizationData,
} from '@contentful/optimization-api-client/api-schemas'
import type { LifecycleInterceptors } from '../CoreBase'
import EventBuilder from '../events/EventBuilder'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import {
  event as eventSignal,
  experienceRequestState,
  online as onlineSignal,
  profile as profileSignal,
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

function createRouteData(route: string, experienceId?: string): OptimizationData {
  return {
    ...SAMPLE_DATA,
    profile: { ...profileFixture, traits: { route } },
    selectedOptimizations:
      experienceId === undefined
        ? []
        : [{ experienceId, sticky: false, variantIndex: 0, variants: {} }],
  }
}

class ExperienceQueueTestHarness extends ExperienceQueue {
  async invokeUpsert(events: ExperienceEventArray): Promise<OptimizationData> {
    return await this.upsertProfile(events)
  }
}

interface BuildQueueOptions {
  eventInterceptors?: LifecycleInterceptors['event']
  stateInterceptors?: LifecycleInterceptors['state']
  upsertProfile?: (payload: {
    profileId?: string
    events: ExperienceEventArray
  }) => Promise<OptimizationData>
}

const buildQueue = ({
  eventInterceptors = new InterceptorManager(),
  stateInterceptors = new InterceptorManager(),
  upsertProfile,
}: BuildQueueOptions = {}): {
  advanceCurrentStateGeneration: () => void
  currentStateGeneration: number
  queue: ExperienceQueueTestHarness
  upsertProfile: ReturnType<typeof rs.fn>
} => {
  const upsertProfileMock =
    upsertProfile !== undefined
      ? rs.fn(upsertProfile)
      : rs.fn(async () => await Promise.resolve(SAMPLE_DATA))
  let currentStateGeneration = 1
  const queue = new ExperienceQueueTestHarness({
    experienceApi: { upsertProfile: upsertProfileMock },
    eventInterceptors,
    flushPolicy: resolveQueueFlushPolicy(undefined),
    getAnonymousId: () => undefined,
    getCurrentStateGeneration: () => currentStateGeneration,
    offlineMaxEvents: 100,
    stateInterceptors,
  })

  return {
    advanceCurrentStateGeneration: () => {
      currentStateGeneration += 1
      queue.invalidateRequests()
    },
    currentStateGeneration,
    queue,
    upsertProfile: upsertProfileMock,
  }
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
  beforeEach(() => {
    experienceRequestState.value = { status: 'idle' }
    eventSignal.value = undefined
    onlineSignal.value = true
    profileSignal.value = undefined
    selectedOptimizationsSignal.value = undefined
  })

  afterEach(() => {
    experienceRequestState.value = { status: 'idle' }
    eventSignal.value = undefined
    onlineSignal.value = true
    profileSignal.value = undefined
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

  it('keeps the latest page response when requests resolve out of order', async () => {
    const routeB = Promise.withResolvers<OptimizationData>()
    const routeC = Promise.withResolvers<OptimizationData>()
    const routeBData = createRouteData('B', 'route-b')
    const routeCData = createRouteData('C', 'route-c')
    let requestCount = 0
    const { queue } = buildQueue({
      upsertProfile: async () => await (requestCount++ === 0 ? routeB.promise : routeC.promise),
    })

    const requestB = queue.invokeUpsert([])
    const requestC = queue.invokeUpsert([])

    routeC.resolve(routeCData)
    await expect(requestC).resolves.toBe(routeCData)
    routeB.resolve(routeBData)
    await expect(requestB).resolves.toBe(routeBData)

    expect(profileSignal.value).toEqual(routeCData.profile)
    expect(selectedOptimizationsSignal.value).toEqual(routeCData.selectedOptimizations)
    expect(experienceRequestState.value).toEqual({ status: 'success' })
  })

  it('does not apply a response after requests are invalidated', async () => {
    const response = Promise.withResolvers<OptimizationData>()
    const { queue } = buildQueue({
      upsertProfile: async () => await response.promise,
    })

    const request = queue.invokeUpsert([])
    queue.invalidateRequests()

    response.resolve(SAMPLE_DATA)
    await request

    expect(profileSignal.value).toBeUndefined()
    expect(selectedOptimizationsSignal.value).toBeUndefined()
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
  })

  it('rejects an offline current-state event without publishing or enqueueing it', async () => {
    const { currentStateGeneration, queue, upsertProfile } = buildQueue()
    const eventBuilder = new EventBuilder({
      channel: 'web',
      library: { name: 'test', version: '0.0.0' },
    })
    onlineSignal.value = false

    await expect(
      queue.sendCurrentState(eventBuilder.buildPageView({}), currentStateGeneration),
    ).resolves.toEqual({ accepted: false })

    expect(eventSignal.value).toBeUndefined()
    onlineSignal.value = true
    await queue.flush()
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('does not publish or send a current-state event superseded during interception', async () => {
    const interception = Promise.withResolvers<undefined>()
    const interceptionStarted = Promise.withResolvers<undefined>()
    const eventInterceptors = new InterceptorManager<
      Parameters<LifecycleInterceptors['event']['run']>[0]
    >()
    eventInterceptors.add(async (event) => {
      interceptionStarted.resolve(undefined)
      await interception.promise
      return event
    })
    const { advanceCurrentStateGeneration, currentStateGeneration, queue, upsertProfile } =
      buildQueue({ eventInterceptors })
    const eventBuilder = new EventBuilder({
      channel: 'web',
      library: { name: 'test', version: '0.0.0' },
    })
    const request = queue.sendCurrentState(eventBuilder.buildPageView({}), currentStateGeneration)
    await interceptionStarted.promise

    advanceCurrentStateGeneration()
    interception.resolve(undefined)

    await expect(request).resolves.toEqual({ accepted: false })
    expect(eventSignal.value).toBeUndefined()
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
  })

  it('does not apply a current-state response superseded during state interception', async () => {
    const interception = Promise.withResolvers<undefined>()
    const interceptionStarted = Promise.withResolvers<undefined>()
    const stateInterceptors = new InterceptorManager<
      Parameters<LifecycleInterceptors['state']['run']>[0]
    >()
    stateInterceptors.add(async (data) => {
      interceptionStarted.resolve(undefined)
      await interception.promise
      return data
    })
    const { advanceCurrentStateGeneration, currentStateGeneration, queue } = buildQueue({
      stateInterceptors,
    })
    const eventBuilder = new EventBuilder({
      channel: 'web',
      library: { name: 'test', version: '0.0.0' },
    })
    const request = queue.sendCurrentState(eventBuilder.buildPageView({}), currentStateGeneration)
    await interceptionStarted.promise

    advanceCurrentStateGeneration()
    interception.resolve(undefined)

    await expect(request).resolves.toEqual({ accepted: true, data: SAMPLE_DATA })
    expect(profileSignal.value).toBeUndefined()
    expect(selectedOptimizationsSignal.value).toBeUndefined()
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
  })
})
