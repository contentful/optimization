import type {
  BatchInsightsEventArray,
  ViewEvent,
} from '@contentful/optimization-api-client/api-schemas'
import EventBuilder from '../events/EventBuilder'
import { InterceptorManager } from '../lib/interceptor'
import { resolveQueueFlushPolicy } from '../lib/queue'
import { previewMode as previewModeSignal, profile as profileSignal } from '../signals'
import { profile as profileFixture } from '../test/fixtures/profile'
import { InsightsQueue } from './InsightsQueue'

interface BuildQueueOptions {
  sendBatchEvents?: (batches: BatchInsightsEventArray) => Promise<boolean>
}

const buildQueue = ({ sendBatchEvents }: BuildQueueOptions = {}): {
  queue: InsightsQueue
  sendBatchEvents: ReturnType<typeof rs.fn>
} => {
  const sendBatchEventsMock =
    sendBatchEvents !== undefined
      ? rs.fn(sendBatchEvents)
      : rs.fn(async () => await Promise.resolve(true))

  const queue = new InsightsQueue({
    eventInterceptors: new InterceptorManager(),
    flushPolicy: resolveQueueFlushPolicy(undefined),
    insightsApi: { sendBatchEvents: sendBatchEventsMock },
  })

  return { queue, sendBatchEvents: sendBatchEventsMock }
}

describe('InsightsQueue', () => {
  beforeEach(() => {
    profileSignal.value = profileFixture
    previewModeSignal.value = false
  })

  afterEach(() => {
    profileSignal.value = undefined
    previewModeSignal.value = false
  })

  it('suppresses insights events under preview mode (NT-3678)', async () => {
    const { queue, sendBatchEvents } = buildQueue()
    previewModeSignal.value = true

    await queue.send(buildProbeEvent())

    await queue.flush({ force: true })
    expect(sendBatchEvents).not.toHaveBeenCalled()
  })
})

// NT-3678: schema-valid component view event used to exercise the
// preview-mode short-circuit through the InsightsQueue.
function buildProbeEvent(): ViewEvent {
  return new EventBuilder({
    channel: 'web',
    library: { name: '@contentful/optimization-web', version: '0.0.1' },
    getPageProperties: () => ({
      path: '/',
      query: {},
      referrer: '',
      search: '',
      title: 'preview',
      url: 'https://example.test/',
    }),
  }).buildView({
    componentId: 'component-1',
    experienceId: 'experience-1',
    variantIndex: 0,
    viewId: 'view-1',
    viewDurationMs: 0,
  })
}
