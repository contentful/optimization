import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import type { BlockedEvent, NodeViewTrackingArgs } from './events'
import { batch, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

const BASE_PAYLOAD: NodeViewTrackingArgs = {
  entityId: 'entity-1',
  entityKind: 'Experience',
  variantId: 'variant-a',
  variantIndex: 1,
  optimizationId: 'opt-1',
  viewId: 'view-1',
  viewDurationMs: 250,
}

class CoreStatefulTestHarness extends CoreStateful {
  setOnlineState(isOnline: boolean): void {
    this.online = isOnline
  }
}

describe('CoreStateful.trackNodeView', () => {
  const createdCores: CoreStateful[] = []

  const createCore = (overrides: Partial<CoreStatefulConfig> = {}): CoreStatefulTestHarness => {
    const core = new CoreStatefulTestHarness({ ...config, ...overrides })
    createdCores.push(core)
    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.online.value = true
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
    })
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      const core = createdCores.pop()
      core?.destroy()
    }
    rs.restoreAllMocks()
  })

  it('emits an exo_node_view Insights event carrying the payload fields when consent is granted', async () => {
    const core = createCore({
      defaults: { consent: true, profile: profileFixture },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView(BASE_PAYLOAD)
    await core.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
    const insightsEvent = sendBatchEvents.mock.calls[0]?.[0][0]?.events[0]
    expect(insightsEvent).toEqual(
      expect.objectContaining({
        type: 'exo_node_view',
        entityId: 'entity-1',
        entityKind: 'Experience',
        variantId: 'variant-a',
        variantIndex: 1,
        optimizationId: 'opt-1',
        viewId: 'view-1',
        viewDurationMs: 250,
      }),
    )
  })

  it('defaults anonymousId to the active profile id when the caller omits it', async () => {
    const core = createCore({
      defaults: { consent: true, profile: profileFixture },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView(BASE_PAYLOAD)
    await core.flush()

    const insightsEvent = sendBatchEvents.mock.calls[0]?.[0][0]?.events[0]
    expect(insightsEvent).toEqual(expect.objectContaining({ anonymousId: profileFixture.id }))
  })

  it('prefers an explicit anonymousId over the profile-derived one', async () => {
    const core = createCore({
      defaults: { consent: true, profile: profileFixture },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView({ ...BASE_PAYLOAD, anonymousId: 'anon-override' })
    await core.flush()

    const insightsEvent = sendBatchEvents.mock.calls[0]?.[0][0]?.events[0]
    expect(insightsEvent).toEqual(expect.objectContaining({ anonymousId: 'anon-override' }))
  })

  it('reports a consent-blocked event and does not send when consent is missing', async () => {
    const onEventBlocked = rs.fn()
    const core = createCore({ onEventBlocked, defaults: { profile: profileFixture } })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const blockedEvents: Array<BlockedEvent | undefined> = []
    const subscription = core.states.blockedEventStream.subscribe((event) => {
      blockedEvents.push(event)
    })

    await core.trackNodeView(BASE_PAYLOAD)
    await core.flush()

    expect(sendBatchEvents).not.toHaveBeenCalled()
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'trackNodeView', reason: 'consent' }),
    )
    expect(blockedEvents.at(-1)).toEqual(
      expect.objectContaining({ method: 'trackNodeView', reason: 'consent' }),
    )

    subscription.unsubscribe()
  })

  it('is unblocked when the allow-list opts into exo_node_view', async () => {
    const core = createCore({
      allowedEventTypes: ['exo_node_view'],
      defaults: { profile: profileFixture },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView(BASE_PAYLOAD)
    await core.flush()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
  })

  it('includes parentExperienceId in the emitted event when supplied', async () => {
    const core = createCore({
      defaults: { consent: true, profile: profileFixture },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView({ ...BASE_PAYLOAD, parentExperienceId: 'parent-exp' })
    await core.flush()

    const insightsEvent = sendBatchEvents.mock.calls[0]?.[0][0]?.events[0]
    expect(insightsEvent).toEqual(expect.objectContaining({ parentExperienceId: 'parent-exp' }))
  })
})
