import type { BatchInsightsEventArray } from '@contentful/optimization-api-client/api-schemas'
import EventBuilder from '../events/EventBuilder'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import { online, profile } from '../signals'
import { profile as profileFixture } from '../test/fixtures/profile'
import { InsightsQueue } from './InsightsQueue'

const builder = new EventBuilder({ channel: 'web', library: { name: 'test', version: '1' } })
const queues: InsightsQueue[] = []

function createQueue(
  sendBatchEvents: (batches: BatchInsightsEventArray) => Promise<boolean>,
): InsightsQueue {
  const queue = new InsightsQueue({
    eventInterceptors: new InterceptorManager(),
    flushPolicy: resolveQueueFlushPolicy(undefined),
    insightsApi: { sendBatchEvents },
  })
  queues.push(queue)
  return queue
}

beforeEach(() => {
  online.value = true
  profile.value = { ...profileFixture, id: 'visitor' }
})

afterEach(() => {
  for (const queue of queues.splice(0)) queue.clearQueuedEvents()
})

describe('InsightsQueue flush snapshots', () => {
  it('keeps events added to either the same or a different profile while a request is pending', async () => {
    let completeFirst!: (success: boolean) => void
    const requests: string[][] = []
    const send = rs.fn(async (batches: BatchInsightsEventArray) => {
      requests.push(
        batches.flatMap(({ events }) =>
          events.map((event) =>
            event.type === 'component_click' ? event.componentId : event.type,
          ),
        ),
      )
      if (requests.length === 1) {
        return await new Promise<boolean>((resolve) => {
          completeFirst = resolve
        })
      }
      return true
    })
    const queue = createQueue(send)
    await queue.send(builder.buildClick({ componentId: 'before' }))
    const flushing = queue.flush()
    await queue.send(builder.buildClick({ componentId: 'same-profile' }))
    profile.value = { ...profileFixture, id: 'other-visitor' }
    await queue.send(builder.buildClick({ componentId: 'other-profile' }))
    expect(send.mock.calls[0]?.[0][0]?.events).toHaveLength(1)

    completeFirst(true)
    await flushing
    await queue.flush()

    expect(requests).toEqual([['before'], ['same-profile', 'other-profile']])
  })
})
