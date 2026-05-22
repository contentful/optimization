import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import type { NodeViewTrackingArgs } from './events'
import { batch, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

describe('CoreStateful.trackNodeView', () => {
  const createdCores: CoreStateful[] = []

  const createCore = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({ ...config, ...overrides })
    createdCores.push(core)
    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.online.value = true
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
    })
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      createdCores.pop()?.destroy()
    }
    rs.restoreAllMocks()
  })

  const nodeViewPayload: NodeViewTrackingArgs = {
    entityId: 'exp-sys-id',
    entityKind: 'Experience',
    variant: 'variant-a',
    optimizationId: 'opt-id',
    viewId: 'view-uuid',
    viewDurationMs: 1500,
  }

  it('routes trackNodeView to insights queue when consent is given', async () => {
    const core = createCore({
      defaults: { consent: true, profile: profileFixture },
    })
    const sendSpy = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackNodeView(nodeViewPayload)
    await core.flush()

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const firstCall = sendSpy.mock.calls[0]
    expect(firstCall).toBeDefined()

    const batches = firstCall?.[0] ?? []
    const events = batches.flatMap((b) => b.events)
    expect(events).toHaveLength(1)
    const nodeViewEvent = events.find((e) => e.type === 'exo_view')
    expect(nodeViewEvent).toBeDefined()
    expect(nodeViewEvent?.anonymousId).toBe(profileFixture.id)
  })

  it('blocks trackNodeView when consent is not given', async () => {
    const onEventBlocked = rs.fn()
    const core = createCore({ onEventBlocked })

    await core.trackNodeView(nodeViewPayload)

    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'consent', method: 'trackNodeView' }),
    )
  })
})
