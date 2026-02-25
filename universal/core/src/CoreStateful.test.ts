import type {
  ComponentViewBuilderArgs,
  TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import type { BlockedEvent } from './BlockedEvent'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, signals } from './signals'

const getAnalyticsQueuePolicyBaseBackoffMs = (core: CoreStateful): number | undefined => {
  const flushRuntime = Reflect.get(core.analytics, 'flushRuntime')

  if (typeof flushRuntime !== 'object' || flushRuntime === null) {
    return
  }

  const policy = Reflect.get(flushRuntime, 'policy')

  if (typeof policy !== 'object' || policy === null) {
    return
  }

  const baseBackoffMs = Reflect.get(policy, 'baseBackoffMs')

  return typeof baseBackoffMs === 'number' ? baseBackoffMs : undefined
}

const getPersonalizationQueueMaxEvents = (core: CoreStateful): number | undefined => {
  const policy = Reflect.get(core.personalization, 'queuePolicy')

  if (typeof policy !== 'object' || policy === null) {
    return
  }

  const maxEvents = Reflect.get(policy, 'maxEvents')

  return typeof maxEvents === 'number' ? maxEvents : undefined
}

const getPersonalizationFlushPolicyBaseBackoffMs = (core: CoreStateful): number | undefined => {
  const policy = Reflect.get(core.personalization, 'queuePolicy')

  if (typeof policy !== 'object' || policy === null) {
    return
  }

  const flushPolicy = Reflect.get(policy, 'flushPolicy')

  if (typeof flushPolicy !== 'object' || flushPolicy === null) {
    return
  }

  const baseBackoffMs = Reflect.get(flushPolicy, 'baseBackoffMs')

  return typeof baseBackoffMs === 'number' ? baseBackoffMs : undefined
}

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

describe('CoreStateful blocked event handling', () => {
  const createdCores: CoreStateful[] = []
  const createCoreStateful = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({
      ...config,
      ...overrides,
    })

    createdCores.push(core)

    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.personalizations.value = undefined
      signals.profile.value = undefined
    })
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      const core = createdCores.pop()

      core?.destroy()
    }
  })

  it('emits consent-blocked calls through callback and blockedEventStream', async () => {
    const onEventBlocked = rs.fn()
    const core = createCoreStateful({ onEventBlocked })
    const payload: TrackBuilderArgs = { event: 'purchase' }
    const blockedEvents: Array<BlockedEvent | undefined> = []
    const subscription = core.states.blockedEventStream.subscribe((event) => {
      blockedEvents.push(event)
    })

    await core.track(payload)

    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'consent',
        product: 'personalization',
        method: 'track',
      }),
    )
    expect(blockedEvents.at(-1)).toEqual(
      expect.objectContaining({
        reason: 'consent',
        product: 'personalization',
        method: 'track',
      }),
    )

    subscription.unsubscribe()
  })

  it('does not emit blocked events for repeated component view calls', async () => {
    const onEventBlocked = rs.fn()
    const core = createCoreStateful({
      defaults: { consent: true },
      onEventBlocked,
    })
    const payload: ComponentViewBuilderArgs = { componentId: 'hero-banner' }

    await core.trackComponentView(payload)
    await core.trackComponentView(payload)

    expect(onEventBlocked).not.toHaveBeenCalled()
    expect(signals.blockedEvent.value).toBeUndefined()
  })

  it('uses analytics.queuePolicy when provided', () => {
    const core = createCoreStateful({
      analytics: {
        queuePolicy: {
          baseBackoffMs: 123,
        },
      },
    })

    expect(getAnalyticsQueuePolicyBaseBackoffMs(core)).toBe(123)
  })

  it('uses personalization.queuePolicy when provided', () => {
    const core = createCoreStateful({
      personalization: {
        queuePolicy: {
          maxEvents: 33,
          flushPolicy: {
            baseBackoffMs: 321,
          },
        },
      },
    })

    expect(getPersonalizationQueueMaxEvents(core)).toBe(33)
    expect(getPersonalizationFlushPolicyBaseBackoffMs(core)).toBe(321)
  })

  it('supports only one stateful instance per runtime until destroy is called', () => {
    const first = createCoreStateful()
    const createSecondCore = (): CoreStateful => new CoreStateful(config)

    expect(createSecondCore).toThrowError(/already initialized/i)

    first.destroy()

    expect(() => {
      createCoreStateful()
    }).not.toThrow()
  })
})
