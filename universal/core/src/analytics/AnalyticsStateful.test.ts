import { ApiClient, EventBuilder } from '@contentful/optimization-api-client'
import type { Profile } from '@contentful/optimization-api-client/api-schemas'
import type { LifecycleInterceptors } from '../CoreBase'
import { InterceptorManager } from '../lib/interceptor'
import type {
  QueueFlushFailureContext,
  QueueFlushPolicy,
  QueueFlushRecoveredContext,
} from '../lib/queue'
import { batch, consent, online, profile } from '../signals'
import AnalyticsStateful from './AnalyticsStateful'

interface CreateAnalyticsOptions {
  queuePolicy?: QueueFlushPolicy
  sendBatchEvents?: ApiClient['insights']['sendBatchEvents']
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

const createAnalytics = (options: CreateAnalyticsOptions = {}): AnalyticsStateful => {
  const { queuePolicy } = options
  const sendBatchEvents =
    options.sendBatchEvents ??
    rs.fn<ApiClient['insights']['sendBatchEvents']>().mockResolvedValue(true)
  const api = new ApiClient({
    clientId: 'key_123',
    environment: 'main',
  })
  rs.spyOn(api.insights, 'sendBatchEvents').mockImplementation(sendBatchEvents)

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

  return new AnalyticsStateful({
    api,
    builder,
    interceptors,
    config: {
      defaults: {
        profile: DEFAULT_PROFILE,
      },
      queuePolicy,
    },
  })
}

const getQueuedEventCount = (analytics: AnalyticsStateful): number => {
  const queue = Reflect.get(analytics, 'queue')

  if (!(queue instanceof Map)) {
    return 0
  }

  let count = 0

  queue.forEach((value: unknown) => {
    if (Array.isArray(value)) {
      count += value.length
      return
    }

    if (typeof value !== 'object' || value === null || !('events' in value)) {
      return
    }

    const events = Reflect.get(value, 'events')

    if (Array.isArray(events)) {
      count += events.length
    }
  })

  return count
}

const getQueuedBatchCount = (analytics: AnalyticsStateful): number => {
  const queue = Reflect.get(analytics, 'queue')

  return queue instanceof Map ? queue.size : 0
}

const createViewPayload = (
  componentId: string,
): {
  componentId: string
  componentViewId: string
  viewDurationMs: number
} => ({
  componentId,
  componentViewId: `${componentId}-view-id`,
  viewDurationMs: 1000,
})

describe('AnalyticsStateful.flush policy', () => {
  beforeEach(() => {
    batch(() => {
      consent.value = true
      online.value = true
      profile.value = undefined
    })
    rs.useFakeTimers()
  })

  afterEach(() => {
    rs.restoreAllMocks()
    rs.useRealTimers()
  })

  it('queues events under one batch when profile object references change for the same profile ID', async () => {
    const sendBatchEvents = rs
      .fn<ApiClient['insights']['sendBatchEvents']>()
      .mockResolvedValue(true)
    const analytics = createAnalytics({ sendBatchEvents })

    await analytics.trackComponentView(createViewPayload('hero-banner'))

    const sameProfileId: Profile = {
      ...DEFAULT_PROFILE,
      traits: {
        plan: 'pro',
      },
    }

    profile.value = sameProfileId

    await analytics.trackFlagView(createViewPayload('promo-flag'))
    await analytics.trackComponentClick({ componentId: 'hero-cta' })
    await analytics.trackComponentHover({
      componentId: 'hero-hover',
      componentHoverId: 'hero-hover-id',
      hoverDurationMs: 500,
    })

    expect(getQueuedEventCount(analytics)).toBe(4)
    expect(getQueuedBatchCount(analytics)).toBe(1)

    await analytics.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)

    const [batches] = sendBatchEvents.mock.calls[0] ?? []

    expect(batches).toHaveLength(1)
    expect(batches?.[0]).toEqual(
      expect.objectContaining({
        profile: sameProfileId,
      }),
    )
    expect(batches?.[0]?.events).toHaveLength(4)
    expect(batches?.[0]?.events[0]).toEqual(
      expect.objectContaining({
        componentId: 'hero-banner',
        componentType: 'Entry',
      }),
    )
    expect(batches?.[0]?.events[1]).toEqual(
      expect.objectContaining({
        componentId: 'promo-flag',
        componentType: 'Variable',
      }),
    )
    expect(batches?.[0]?.events[2]).toEqual(
      expect.objectContaining({
        type: 'component_click',
        componentId: 'hero-cta',
        componentType: 'Entry',
      }),
    )
    expect(batches?.[0]?.events[3]).toEqual(
      expect.objectContaining({
        type: 'component_hover',
        componentId: 'hero-hover',
        componentHoverId: 'hero-hover-id',
        hoverDurationMs: 500,
        componentType: 'Entry',
      }),
    )

    analytics.reset()
  })

  it('retries failed flushes with backoff and clears the queue after recovery', async () => {
    const sendBatchEvents = rs
      .fn<ApiClient['insights']['sendBatchEvents']>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
    const onFlushRecovered = rs.fn<(context: QueueFlushRecoveredContext) => void>()

    const analytics = createAnalytics({
      sendBatchEvents,
      queuePolicy: {
        baseBackoffMs: 20,
        maxBackoffMs: 20,
        jitterRatio: 0,
        maxConsecutiveFailures: 5,
        circuitOpenMs: 200,
        onFlushFailure,
        onFlushRecovered,
      },
    })

    await analytics.trackComponentView(createViewPayload('hero-banner'))
    await analytics.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
    expect(onFlushFailure).toHaveBeenCalledTimes(1)
    expect(onFlushFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 1,
        queuedBatches: 1,
        queuedEvents: 1,
        retryDelayMs: 20,
      }),
    )
    expect(getQueuedEventCount(analytics)).toBe(1)

    await rs.advanceTimersByTimeAsync(20)

    expect(sendBatchEvents).toHaveBeenCalledTimes(2)
    expect(onFlushFailure).toHaveBeenCalledTimes(2)
    expect(getQueuedEventCount(analytics)).toBe(1)

    await rs.advanceTimersByTimeAsync(20)

    expect(sendBatchEvents).toHaveBeenCalledTimes(3)
    expect(onFlushRecovered).toHaveBeenCalledTimes(1)
    expect(onFlushRecovered).toHaveBeenCalledWith({ consecutiveFailures: 2 })
    expect(getQueuedEventCount(analytics)).toBe(0)

    analytics.reset()
  })

  it('opens a circuit window after repeated failures and retries after circuit cooldown', async () => {
    const sendBatchEvents = rs
      .fn<ApiClient['insights']['sendBatchEvents']>()
      .mockResolvedValue(false)
    const onCircuitOpen = rs.fn<(context: QueueFlushFailureContext) => void>()

    const analytics = createAnalytics({
      sendBatchEvents,
      queuePolicy: {
        baseBackoffMs: 5,
        maxBackoffMs: 5,
        jitterRatio: 0,
        maxConsecutiveFailures: 2,
        circuitOpenMs: 50,
        onCircuitOpen,
      },
    })

    await analytics.trackComponentView(createViewPayload('hero-banner'))
    await analytics.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)

    await rs.advanceTimersByTimeAsync(5)

    expect(sendBatchEvents).toHaveBeenCalledTimes(2)
    expect(onCircuitOpen).toHaveBeenCalledTimes(1)
    expect(onCircuitOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutiveFailures: 2,
        queuedBatches: 1,
        queuedEvents: 1,
        retryDelayMs: 50,
      }),
    )
    expect(getQueuedEventCount(analytics)).toBe(1)

    await rs.advanceTimersByTimeAsync(49)
    expect(sendBatchEvents).toHaveBeenCalledTimes(2)

    await rs.advanceTimersByTimeAsync(1)
    expect(sendBatchEvents).toHaveBeenCalledTimes(3)

    analytics.reset()
  })

  it('supports force flushes that bypass an active backoff window', async () => {
    const sendBatchEvents = rs
      .fn<ApiClient['insights']['sendBatchEvents']>()
      .mockResolvedValue(false)

    const analytics = createAnalytics({
      sendBatchEvents,
      queuePolicy: {
        baseBackoffMs: 1_000,
        maxBackoffMs: 1_000,
        jitterRatio: 0,
        maxConsecutiveFailures: 10,
        circuitOpenMs: 1_000,
      },
    })

    await analytics.trackComponentView(createViewPayload('hero-banner'))
    await analytics.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)

    await analytics.flush()
    expect(sendBatchEvents).toHaveBeenCalledTimes(1)

    await analytics.flush({ force: true })
    expect(sendBatchEvents).toHaveBeenCalledTimes(2)

    analytics.reset()
  })

  it('treats thrown send errors as flush failures and retries', async () => {
    const sendBatchEvents = rs
      .fn<ApiClient['insights']['sendBatchEvents']>()
      .mockRejectedValueOnce(new Error('network-down'))
      .mockResolvedValueOnce(true)

    const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
    const onFlushRecovered = rs.fn<(context: QueueFlushRecoveredContext) => void>()

    const analytics = createAnalytics({
      sendBatchEvents,
      queuePolicy: {
        baseBackoffMs: 15,
        maxBackoffMs: 15,
        jitterRatio: 0,
        maxConsecutiveFailures: 5,
        circuitOpenMs: 200,
        onFlushFailure,
        onFlushRecovered,
      },
    })

    await analytics.trackComponentView(createViewPayload('hero-banner'))
    await analytics.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
    expect(onFlushFailure).toHaveBeenCalledTimes(1)
    expect(getQueuedEventCount(analytics)).toBe(1)

    await rs.advanceTimersByTimeAsync(15)

    expect(sendBatchEvents).toHaveBeenCalledTimes(2)
    expect(onFlushRecovered).toHaveBeenCalledTimes(1)
    expect(onFlushRecovered).toHaveBeenCalledWith({ consecutiveFailures: 1 })
    expect(getQueuedEventCount(analytics)).toBe(0)

    analytics.reset()
  })
})
