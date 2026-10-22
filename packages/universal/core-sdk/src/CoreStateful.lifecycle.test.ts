import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import { getCoreBridgeCapabilities } from './bridge-support/capabilities'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'

const data: OptimizationData = {
  profile: profileFixture,
  changes: [],
  selectedOptimizations: [],
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let complete!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    complete = resolve
  })
  return { promise, resolve: complete }
}

describe('CoreStateful runtime lifecycle', () => {
  const cores: CoreStateful[] = []

  const createCore = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true },
      ...overrides,
    })
    rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    cores.push(core)
    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.changes.value = undefined
      signals.selectedOptimizations.value = undefined
      signals.experienceRequestState.value = { status: 'idle' }
      signals.event.value = undefined
      signals.blockedEvent.value = undefined
      signals.online.value = true
    })
  })

  afterEach(() => {
    for (const core of cores.splice(0)) core.destroy()
    rs.restoreAllMocks()
  })

  it.each(['reset', 'withdraw', 'destroy', 'replace'] as const)(
    'ignores a pending direct response after %s',
    async (action) => {
      const core = createCore()
      const response = deferred<OptimizationData>()
      rs.spyOn(core.api.experience, 'upsertProfile').mockReturnValue(response.promise)
      const pending = core.page()
      await rs.waitFor(() => {
        expect(core.api.experience.upsertProfile).toHaveBeenCalledTimes(1)
      })

      if (action === 'reset') core.reset()
      if (action === 'withdraw') core.consent(false)
      if (action === 'destroy' || action === 'replace') core.destroy()
      if (action === 'replace') createCore()
      const currentRequestState = signals.experienceRequestState.value

      response.resolve(data)
      await pending

      expect(signals.profile.value).toBeUndefined()
      expect(signals.selectedOptimizations.value).toBeUndefined()
      expect(signals.experienceRequestState.value).toEqual(currentRequestState)
    },
  )

  it.each(['experience', 'insights'] as const)(
    'does not send or publish a %s event whose interceptor resumes after reset',
    async (destination) => {
      const core = createCore({
        defaults: {
          consent: true,
          profile: destination === 'insights' ? profileFixture : undefined,
        },
      })
      const resume = deferred<undefined>()
      const entered = deferred<undefined>()
      core.interceptors.event.add(async (event) => {
        entered.resolve(undefined)
        await resume.promise
        return event
      })
      const upsert = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(data)
      const pending =
        destination === 'experience' ? core.page() : core.trackClick({ componentId: 'component' })
      await entered.promise
      core.reset()
      resume.resolve(undefined)
      await pending
      await core.flush()

      expect(core.api.insights.sendBatchEvents).not.toHaveBeenCalled()
      expect(upsert).not.toHaveBeenCalled()
      expect(signals.event.value).toBeUndefined()
      expect(signals.experienceRequestState.value).toEqual({ status: 'idle' })
    },
  )

  it('does not publish state whose interceptor resumes after reset', async () => {
    const core = createCore()
    const resume = deferred<undefined>()
    const entered = deferred<undefined>()
    rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(data)
    core.interceptors.state.add(async (state) => {
      entered.resolve(undefined)
      await resume.promise
      return state
    })
    const pending = core.page()
    await entered.promise
    core.reset()
    resume.resolve(undefined)
    await pending

    expect(signals.profile.value).toBeUndefined()
    expect(signals.selectedOptimizations.value).toBeUndefined()
    expect(signals.experienceRequestState.value).toEqual({ status: 'idle' })
  })

  it.each(['reset', 'destroy'] as const)(
    'does not publish bridge hydration whose interceptor resumes after %s',
    async (action) => {
      const core = createCore()
      const resume = deferred<undefined>()
      const entered = deferred<undefined>()
      core.interceptors.state.add(async (state) => {
        entered.resolve(undefined)
        await resume.promise
        return state
      })
      const bridge = getCoreBridgeCapabilities(core)
      expect(bridge).toBeDefined()
      const pending = bridge?.hydrateOptimizationData(data)
      await entered.promise
      if (action === 'reset') core.reset()
      else core.destroy()
      const currentRequestState = signals.experienceRequestState.value
      resume.resolve(undefined)
      await pending

      expect(signals.profile.value).toBeUndefined()
      expect(signals.selectedOptimizations.value).toBeUndefined()
      expect(signals.experienceRequestState.value).toEqual(currentRequestState)
    },
  )

  it('ignores new hydration through a destroyed runtime bridge', async () => {
    const core = createCore()
    const bridge = getCoreBridgeCapabilities(core)
    const interceptState = rs.fn(() => data)
    core.interceptors.state.add(interceptState)
    core.destroy()
    createCore()
    const currentRequestState = signals.experienceRequestState.value

    await bridge?.hydrateOptimizationData(data)

    expect(interceptState).not.toHaveBeenCalled()
    expect(signals.profile.value).toBeUndefined()
    expect(signals.experienceRequestState.value).toEqual(currentRequestState)
  })

  it('purges queued Experience and Insights events on reset', async () => {
    const core = createCore({ defaults: { consent: true, profile: profileFixture } })
    const upsert = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(data)
    signals.online.value = false
    await core.page()
    await core.trackClick({ componentId: 'component' })

    core.reset()
    signals.online.value = true
    await core.flush()

    expect(upsert).not.toHaveBeenCalled()
    expect(core.api.insights.sendBatchEvents).not.toHaveBeenCalled()
    expect(signals.profile.value).toBeUndefined()
  })

  it('allows a fresh flag view with the same identity after resetting a pending attempt', async () => {
    const core = createCore({ defaults: { consent: true, profile: profileFixture } })
    const resume = deferred<undefined>()
    core.interceptors.event.add(async (event) => {
      await resume.promise
      return event
    })
    const trackFlagView = rs.spyOn(core, 'trackFlagView')
    core.getFlag('flag')
    core.reset()
    signals.profile.value = profileFixture
    core.getFlag('flag')
    expect(trackFlagView).toHaveBeenCalledTimes(2)

    resume.resolve(undefined)
    await rs.waitFor(() => {
      expect(signals.event.value).toBeDefined()
    })
    await core.flush()
    expect(core.api.insights.sendBatchEvents).toHaveBeenCalledTimes(1)
  })

  it('makes destroy idempotent when the final transport synchronously requests teardown', async () => {
    const core = createCore({ defaults: { consent: true, profile: profileFixture } })
    signals.online.value = false
    await core.trackClick({ componentId: 'component' })
    const sendBatchEvents = rs
      .spyOn(core.api.insights, 'sendBatchEvents')
      .mockImplementation(async () => {
        core.destroy()
        return await Promise.resolve(true)
      })

    core.destroy()
    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
  })

  it('does not admit events or mutate consent after destruction', async () => {
    const core = createCore()
    const upsert = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(data)
    core.destroy()
    const replacement = createCore()
    const eventBefore = signals.event.value
    const blockedBefore = signals.blockedEvent.value

    core.consent(false)
    expect(await core.page()).toEqual({ accepted: false })
    await core.trackClick({ componentId: 'component' })
    core.reset()

    expect(replacement.states.consent.current).toBe(true)
    expect(upsert).not.toHaveBeenCalled()
    expect(signals.event.value).toBe(eventBefore)
    expect(signals.blockedEvent.value).toBe(blockedBefore)
  })
})
