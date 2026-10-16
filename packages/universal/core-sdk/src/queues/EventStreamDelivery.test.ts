import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import type { EventOptimizationContext, OptimizationEventStreamEvent } from '../events'
import EventBuilder from '../events/EventBuilder'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import OptimizedEntryResolver from '../resolvers/OptimizedEntryResolver'
import { event, online, profile, toObservable, type Subscription } from '../signals'
import { optimizedEntry } from '../test/fixtures/optimizedEntry'
import { profile as profileFixture } from '../test/fixtures/profile'
import { selectedOptimizations } from '../test/fixtures/selectedOptimizations'
import { ExperienceQueue } from './ExperienceQueue'
import { InsightsQueue } from './InsightsQueue'

const builder = new EventBuilder({ channel: 'web', library: { name: 'test', version: '1' } })
const sampleData: OptimizationData = {
  profile: profileFixture,
  changes: [],
  selectedOptimizations: [],
}
const queues: Array<ExperienceQueue | InsightsQueue> = []
const subscriptions: Subscription[] = []

function createOptimizationContext(): EventOptimizationContext {
  const { optimizationContext } = OptimizedEntryResolver.resolveWithContext(
    optimizedEntry,
    selectedOptimizations,
  )
  if (!optimizationContext) throw new Error('Expected fixture to resolve an optimization context')
  return { ...optimizationContext, contextId: 'event-stream-context' }
}

function observeWithThrowingSubscriber(): OptimizationEventStreamEvent[] {
  const received: OptimizationEventStreamEvent[] = []
  subscriptions.push(
    toObservable(event, (value) => value).subscribe((value) => {
      if (!value) return
      received.push(value)
      throw new Error('Event stream observer failed')
    }),
  )
  return received
}

function createExperienceQueue(
  upsertProfile: ConstructorParameters<typeof ExperienceQueue>[0]['experienceApi']['upsertProfile'],
): ExperienceQueue {
  const queue = new ExperienceQueue({
    experienceApi: { upsertProfile },
    eventInterceptors: new InterceptorManager(),
    stateInterceptors: new InterceptorManager(),
    flushPolicy: resolveQueueFlushPolicy(undefined),
    getAnonymousId: () => undefined,
    offlineMaxEvents: 100,
  })
  queues.push(queue)
  return queue
}

beforeEach(() => {
  event.value = undefined
  online.value = true
  profile.value = profileFixture
})

afterEach(() => {
  for (const subscription of subscriptions.splice(0)) subscription.unsubscribe()
  for (const queue of queues.splice(0)) queue.clearQueuedEvents()
  event.value = undefined
  online.value = true
  profile.value = undefined
})

describe('Event stream observer error containment', () => {
  it('delivers online Experience events with original API payloads despite throwing observers', async () => {
    const upsertProfile = rs.fn(async () => await Promise.resolve(sampleData))
    const queue = createExperienceQueue(upsertProfile)
    const received = observeWithThrowingSubscriber()
    const context = createOptimizationContext()
    const first = builder.buildPageView()
    const second = builder.buildTrack({ event: 'next-event' })

    await expect(queue.send(first, context)).resolves.toEqual({ accepted: true, data: sampleData })
    await expect(queue.send(second)).resolves.toEqual({ accepted: true, data: sampleData })

    expect(received).toEqual([{ ...first, optimization: context }, second])
    expect(received[0]?.optimization).toBe(context)
    expect(upsertProfile.mock.calls).toEqual([
      [{ profileId: profileFixture.id, events: [first] }],
      [{ profileId: profileFixture.id, events: [second] }],
    ])
  })

  it('queues offline Experience events and retries delivery without republishing the stream', async () => {
    const upsertProfile = rs.fn(async () => await Promise.resolve(sampleData))
    upsertProfile.mockRejectedValueOnce(new Error('Temporary Experience API failure'))
    const queue = createExperienceQueue(upsertProfile)
    const received = observeWithThrowingSubscriber()
    const context = createOptimizationContext()
    const first = builder.buildPageView()
    const second = builder.buildTrack({ event: 'queued-event' })
    online.value = false

    await expect(queue.send(first, context)).resolves.toEqual({ accepted: true })
    await expect(queue.send(second)).resolves.toEqual({ accepted: true })
    expect(upsertProfile).not.toHaveBeenCalled()

    online.value = true
    await queue.flush()
    await queue.flush({ force: true })
    await queue.flush({ force: true })

    expect(received).toEqual([{ ...first, optimization: context }, second])
    expect(received[0]?.optimization).toBe(context)
    expect(upsertProfile.mock.calls).toEqual([
      [{ profileId: profileFixture.id, events: [first, second] }],
      [{ profileId: profileFixture.id, events: [first, second] }],
    ])
  })

  it('queues Insights events and retries original batches without republishing the stream', async () => {
    const sendBatchEvents = rs.fn(async () => await Promise.resolve(true))
    sendBatchEvents.mockResolvedValueOnce(false)
    const queue = new InsightsQueue({
      insightsApi: { sendBatchEvents },
      eventInterceptors: new InterceptorManager(),
      flushPolicy: resolveQueueFlushPolicy(undefined),
    })
    queues.push(queue)
    const received = observeWithThrowingSubscriber()
    const context = createOptimizationContext()
    const first = builder.buildClick({ componentId: optimizedEntry.sys.id })
    const second = builder.buildClick({ componentId: 'next-entry' })
    online.value = false

    await expect(queue.send(first, context)).resolves.toBeUndefined()
    await expect(queue.send(second)).resolves.toBeUndefined()
    expect(sendBatchEvents).not.toHaveBeenCalled()

    online.value = true
    await queue.flush()
    await queue.flush({ force: true })
    await queue.flush({ force: true })

    expect(received).toEqual([{ ...first, optimization: context }, second])
    expect(received[0]?.optimization).toBe(context)
    const batches = [{ profile: profileFixture, events: [first, second] }]
    expect(sendBatchEvents.mock.calls).toEqual([[batches], [batches]])
  })
})
