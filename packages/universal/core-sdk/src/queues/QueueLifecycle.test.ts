import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import EventBuilder from '../events/EventBuilder'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import { experienceRequestState, online, profile, selectedOptimizations } from '../signals'
import { profile as profileFixture } from '../test/fixtures/profile'
import { ExperienceQueue } from './ExperienceQueue'
import { InsightsQueue } from './InsightsQueue'

const builder = new EventBuilder({ channel: 'web', library: { name: 'test', version: '1' } })
const sampleData: OptimizationData = {
  profile: profileFixture,
  changes: [],
  selectedOptimizations: [],
}
const queues: Array<ExperienceQueue | InsightsQueue> = []

function createExperienceQueue(
  upsertProfile: ConstructorParameters<typeof ExperienceQueue>[0]['experienceApi']['upsertProfile'],
  getResetToken: () => object | undefined,
): ExperienceQueue {
  const queue = new ExperienceQueue({
    experienceApi: { upsertProfile },
    eventInterceptors: new InterceptorManager(),
    stateInterceptors: new InterceptorManager(),
    flushPolicy: resolveQueueFlushPolicy(undefined),
    getAnonymousId: () => undefined,
    getResetToken,
    offlineMaxEvents: 100,
  })
  queues.push(queue)
  return queue
}

beforeEach(() => {
  rs.useFakeTimers()
  online.value = true
  profile.value = profileFixture
  selectedOptimizations.value = undefined
  experienceRequestState.value = { status: 'idle' }
})

afterEach(() => {
  for (const queue of queues.splice(0)) queue.clearQueuedEvents()
  rs.useRealTimers()
  profile.value = undefined
  selectedOptimizations.value = undefined
  experienceRequestState.value = { status: 'idle' }
})

describe('Queue lifecycle ownership', () => {
  it.each([true, false])(
    'ignores stale Insights flush settlement (%s) after the queue is cleared',
    async (oldSuccess) => {
      const oldResponse = Promise.withResolvers<boolean>()
      const onFlushFailure = rs.fn()
      const sendBatchEvents = rs.fn(async () => await Promise.resolve(true))
      sendBatchEvents.mockImplementationOnce(async () => await oldResponse.promise)
      const queue = new InsightsQueue({
        insightsApi: { sendBatchEvents },
        eventInterceptors: new InterceptorManager(),
        flushPolicy: resolveQueueFlushPolicy({ onFlushFailure }),
      })
      queues.push(queue)
      const oldEvent = builder.buildClick({ componentId: 'old-entry' })
      const freshEvent = builder.buildClick({ componentId: 'fresh-entry' })

      await queue.send(oldEvent)
      const oldFlush = queue.flush()
      queue.clearQueuedEvents()
      await queue.send(freshEvent)
      expect(rs.getTimerCount()).toBe(1)

      oldResponse.resolve(oldSuccess)
      await oldFlush

      expect(onFlushFailure).not.toHaveBeenCalled()
      expect(rs.getTimerCount()).toBe(1)
      await queue.flush()

      expect(sendBatchEvents.mock.calls).toEqual([
        [[{ profile: profileFixture, events: [oldEvent] }]],
        [[{ profile: profileFixture, events: [freshEvent] }]],
      ])
      expect(rs.getTimerCount()).toBe(0)
    },
  )

  it('flushes Experience teardown with the original profile and suppresses late shared state', async () => {
    const response = Promise.withResolvers<OptimizationData>()
    const upsertProfile = rs.fn(async () => await response.promise)
    let ownerToken: object | undefined = {}
    const queue = createExperienceQueue(upsertProfile, () => ownerToken)
    const queuedEvent = builder.buildPageView()
    online.value = false
    await queue.send(queuedEvent)

    const teardown = queue.flushOnDestroy()
    ownerToken = undefined
    const replacementProfile = { ...profileFixture, id: 'replacement-profile' }
    profile.value = replacementProfile
    experienceRequestState.value = { status: 'idle' }
    response.resolve(sampleData)
    await teardown

    expect(upsertProfile.mock.calls).toEqual([
      [{ profileId: profileFixture.id, events: [queuedEvent] }],
    ])
    expect(profile.value).toBe(replacementProfile)
    expect(selectedOptimizations.value).toBeUndefined()
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
    expect(rs.getTimerCount()).toBe(0)
  })

  it('does not publish a late Experience request failure after its owner is invalidated', async () => {
    const response = Promise.withResolvers<OptimizationData>()
    const started = Promise.withResolvers<undefined>()
    let ownerToken: object | undefined = {}
    const queue = createExperienceQueue(
      async () => {
        started.resolve(undefined)
        return await response.promise
      },
      () => ownerToken,
    )
    const sending = queue.send(builder.buildPageView())
    await started.promise
    expect(experienceRequestState.value).toEqual({ status: 'pending' })

    ownerToken = undefined
    experienceRequestState.value = { status: 'idle' }
    response.reject(new Error('Old request failed after teardown'))

    await expect(sending).resolves.toBeUndefined()
    expect(experienceRequestState.value).toEqual({ status: 'idle' })
  })
})
