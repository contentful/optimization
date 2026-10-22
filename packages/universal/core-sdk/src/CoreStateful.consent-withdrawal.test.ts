import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import CoreStateful from './CoreStateful'
import { signals, type Subscription } from './signals'
import { profile } from './test/fixtures/profile'

describe('Core consent withdrawal ordering', () => {
  let core: CoreStateful | undefined
  let subscription: Subscription | undefined

  afterEach(() => {
    subscription?.unsubscribe()
    core?.destroy()
    rs.restoreAllMocks()
  })

  it('invalidates pending work and purges queues before request-state subscribers can throw', async () => {
    core = new CoreStateful({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true, profile },
    })
    const response = Promise.withResolvers<OptimizationData>()
    const upsert = rs.spyOn(core.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const insights = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    signals.online.value = true
    const pending = core.page()
    await rs.waitFor(() => {
      expect(upsert).toHaveBeenCalledTimes(1)
    })
    signals.online.value = false
    await core.page()
    await core.trackClick({ componentId: 'queued' })
    subscription = core.states.experienceRequestState.subscribe((state) => {
      if (state.status === 'idle') throw new Error('Request-state subscriber failed')
    })
    expect(() => core?.consent(false)).toThrow('Request-state subscriber failed')
    subscription.unsubscribe()
    response.resolve({ profile, changes: [], selectedOptimizations: [] })
    await pending
    signals.online.value = true
    await core.flush()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(insights).not.toHaveBeenCalled()
    expect(core.states.experienceRequestState.current).toEqual({ status: 'idle' })
  })

  it.each(['throw', 'destroy'] as const)(
    'purges both queues before a consent subscriber can %s',
    async (action) => {
      core = new CoreStateful({
        spaceId: 'key_123',
        environment: 'main',
        defaults: { consent: true, profile },
      })
      const upsert = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue({
        profile,
        changes: [],
        selectedOptimizations: [],
      })
      const insights = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
      signals.online.value = false
      await core.page()
      await core.trackClick({ componentId: 'queued' })
      subscription = core.states.consent.subscribe((value) => {
        if (value !== false) return
        if (action === 'throw') throw new Error('Consent subscriber failed')
        core?.destroy()
      })

      if (action === 'throw')
        expect(() => core?.consent(false)).toThrow('Consent subscriber failed')
      else core.consent(false)
      subscription.unsubscribe()
      signals.online.value = true
      await core.flush()
      core.destroy()

      expect(upsert).not.toHaveBeenCalled()
      expect(insights).not.toHaveBeenCalled()
    },
  )
})
