import type { Profile } from '@contentful/optimization-api-client/api-schemas'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, effect, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'

const onlineObservations = new WeakMap<CoreStateful, Array<boolean | undefined>>()
const runtimeChecks = new WeakMap<CoreStateful, number>()

class ObservedCore extends CoreStateful {
  protected override getRuntimeResetToken(): object | undefined {
    runtimeChecks.set(this, (runtimeChecks.get(this) ?? 0) + 1)
    return super.getRuntimeResetToken()
  }

  protected override initializeFlagViewConsentEffect(): void {
    const observed: Array<boolean | undefined> = []
    onlineObservations.set(this, observed)
    this.registerRuntimeEffect(
      effect(() => {
        observed.push(signals.online.value)
      }),
    )
    super.initializeFlagViewConsentEffect()
  }
}

class FailingCore extends ObservedCore {
  static failedInstance: FailingCore | undefined

  protected override initializeFlagViewConsentEffect(): void {
    super.initializeFlagViewConsentEffect()
    FailingCore.failedInstance = this
    throw new Error('Effect initialization failed')
  }
}

const config: CoreStatefulConfig = {
  spaceId: 'key_123',
  environment: 'main',
  defaults: { consent: true },
}

describe('CoreStateful effect ownership', () => {
  const cores: CoreStateful[] = []
  const unsubscribe: Array<() => void> = []

  const createCore = (overrides: Partial<CoreStatefulConfig> = {}): ObservedCore => {
    const core = new ObservedCore({ ...config, ...overrides })
    cores.push(core)
    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.event.value = undefined
      signals.experienceRequestState.value = { status: 'idle' }
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.changes.value = undefined
      signals.selectedOptimizations.value = undefined
      signals.online.value = true
    })
    FailingCore.failedInstance = undefined
  })

  afterEach(() => {
    for (const dispose of unsubscribe.splice(0)) dispose()
    for (const core of cores.splice(0)) core.destroy()
    rs.restoreAllMocks()
  })

  it('releases owned reconnect and flag-consent effects on destroy', async () => {
    const core = createCore()
    core.destroy()
    await core.flush()
    const observedBefore = [...(onlineObservations.get(core) ?? [])]
    const checksBefore = runtimeChecks.get(core)

    signals.online.value = false
    signals.online.value = true
    signals.consent.value = false
    batch(() => {
      signals.profile.value = profileFixture
      signals.consent.value = true
    })

    expect(onlineObservations.get(core)).toEqual(observedBefore)
    expect(runtimeChecks.get(core)).toBe(checksBefore)
  })

  it('releases effects and the singleton when construction fails after acquiring an effect', () => {
    expect(() => new FailingCore(config)).toThrow('Effect initialization failed')
    const failed = FailingCore.failedInstance
    expect(failed).toBeDefined()
    if (failed === undefined) throw new Error('Missing failed runtime')
    const observedBefore = [...(onlineObservations.get(failed) ?? [])]
    const checksBefore = runtimeChecks.get(failed)

    signals.online.value = false
    signals.consent.value = false
    signals.profile.value = profileFixture
    const replacement = createCore()

    expect(onlineObservations.get(failed)).toEqual(observedBefore)
    expect(runtimeChecks.get(failed)).toBe(checksBefore)
    expect(replacement.states.consent.current).toBe(true)
  })

  it('publishes fresh owner diagnostics atomically with configured profile defaults', () => {
    const core = createCore()
    batch(() => {
      signals.event.value = core.eventBuilder.buildPageView({})
      signals.blockedEvent.value = { reason: 'consent', method: 'track', args: [] }
      signals.experienceRequestState.value = { status: 'failed', reason: 'api-error' }
    })
    core.destroy()
    const observations: Array<{
      event: unknown
      blocked: unknown
      status: string
    }> = []
    unsubscribe.push(
      signals.profile.subscribe(() => {
        observations.push({
          event: signals.event.value,
          blocked: signals.blockedEvent.value,
          status: signals.experienceRequestState.value.status,
        })
      }),
    )

    const replacement = createCore({ defaults: { consent: true, profile: profileFixture } })

    expect(replacement.states.profile.current).toEqual(profileFixture)
    expect(observations.at(-1)).toEqual({ event: undefined, blocked: undefined, status: 'idle' })
    expect(replacement.states.eventStream.current).toBeUndefined()
    expect(replacement.states.blockedEventStream.current).toBeUndefined()
    expect(replacement.states.experienceRequestState.current).toEqual({ status: 'idle' })
  })

  it('preserves caller-owned subscriptions across reset and replacement', () => {
    const core = createCore({ defaults: { consent: true, profile: profileFixture } })
    const profiles: Array<Profile | undefined> = []
    const flags: unknown[] = []
    rs.spyOn(core, 'trackFlagView').mockResolvedValue(undefined)
    const profileSubscription = core.states.profile.subscribe((profile) => profiles.push(profile))
    const flagSubscription = core.states.flag('enabled').subscribe((flag) => flags.push(flag))
    unsubscribe.push(profileSubscription.unsubscribe, flagSubscription.unsubscribe)

    core.reset()
    core.destroy()
    const replacementProfile = { ...profileFixture, id: 'replacement' }
    createCore({ defaults: { consent: true, profile: replacementProfile } })
    signals.changes.value = [
      {
        key: 'enabled',
        type: 'Variable',
        value: true,
        meta: { experienceId: 'experience', variantIndex: 0 },
      },
    ]

    expect(profiles).toEqual([profileFixture, undefined, replacementProfile])
    expect(flags).toEqual([undefined, true])
  })
})
