import type { OptimizationData } from '@contentful/optimization-api-schemas'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'
import { selectedOptimizations as selectedOptimizationsFixture } from './test/fixtures/selectedOptimizations'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

class CoreStatefulTestHarness extends CoreStateful {
  setOnlineState(isOnline: boolean): void {
    this.online = isOnline
  }
}

describe('CoreStateful personalization request/response', () => {
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
      signals.experienceRequestState.value = { status: 'idle' }
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
  })

  describe('getPersonalizationRequest', () => {
    it('returns { events: [] } when nothing is queued and no profile is held', () => {
      const core = createCore({ defaults: { consent: true } })

      const request = core.getPersonalizationRequest()

      expect(request).toEqual({ events: [] })
    })

    it('includes profileId from the current profile signal when present', () => {
      const core = createCore({
        defaults: { consent: true, profile: { ...profileFixture, id: 'profile-abc' } },
      })

      const request = core.getPersonalizationRequest()

      expect(request).toEqual({ profileId: 'profile-abc', events: [] })
    })

    it('drains queued Experience events when consent is granted', async () => {
      const core = createCore({ defaults: { consent: true } })

      core.setOnlineState(false)
      await core.track({ event: 'e1' })
      await core.track({ event: 'e2' })

      const { events } = core.getPersonalizationRequest()

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({ type: 'track', event: 'e1' })
      expect(events[1]).toMatchObject({ type: 'track', event: 'e2' })

      // Second call should find the queue empty — drain clears it.
      expect(core.getPersonalizationRequest().events).toEqual([])
    })

    it('leaves events queued and reports a blocked event when consent is not granted', async () => {
      const onEventBlocked = rs.fn()
      const core = createCore({
        defaults: { consent: true },
        onEventBlocked,
      })

      core.setOnlineState(false)
      await core.track({ event: 'e1' })

      // Revoke consent by writing the signal directly. The public
      // `core.consent(false)` API purges the queue as a side effect; we want
      // to observe the drain gate's own behavior when the queue still holds
      // events at consent-revocation time.
      signals.consent.value = false

      const request = core.getPersonalizationRequest()

      expect(request.events).toEqual([])
      expect(onEventBlocked).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'consent',
          method: 'getPersonalizationRequest',
        }),
      )

      // Restore consent — the queued event should still be drainable.
      signals.consent.value = true
      const retried = core.getPersonalizationRequest()

      expect(retried.events).toHaveLength(1)
      expect(retried.events[0]).toMatchObject({ type: 'track', event: 'e1' })
    })

    it('is unblocked when the allow-list opts in to any personalization event type', async () => {
      const core = createCore({ allowedEventTypes: ['identify'] })

      core.setOnlineState(false)
      await core.identify({ userId: 'user-1' })

      const request = core.getPersonalizationRequest()

      expect(request.events).toHaveLength(1)
      expect(request.events[0]).toMatchObject({ type: 'identify' })
    })
  })

  describe('ingestPersonalizationResponse', () => {
    const responseData: OptimizationData = {
      profile: { ...profileFixture, id: 'profile-xyz' },
      selectedOptimizations: selectedOptimizationsFixture,
      changes: [
        {
          key: 'dark-mode',
          type: 'Variable',
          value: true,
          meta: { experienceId: 'exp-1', variantIndex: 0 },
        },
      ],
    }

    it('applies profile, selectedOptimizations, and marks the request state success', async () => {
      const core = createCore({ defaults: { consent: true } })

      core.ingestPersonalizationResponse(responseData)
      await Promise.resolve()

      expect(signals.profile.value?.id).toBe('profile-xyz')
      expect(signals.selectedOptimizations.value).toEqual(selectedOptimizationsFixture)
      expect(signals.experienceRequestState.value).toEqual({ status: 'success' })
    })

    it('is a no-op when called with undefined', () => {
      const core = createCore({ defaults: { consent: true } })
      const before = {
        profile: signals.profile.value,
        selectedOptimizations: signals.selectedOptimizations.value,
        experienceRequestState: signals.experienceRequestState.value,
      }

      core.ingestPersonalizationResponse(undefined)

      expect(signals.profile.value).toBe(before.profile)
      expect(signals.selectedOptimizations.value).toBe(before.selectedOptimizations)
      expect(signals.experienceRequestState.value).toBe(before.experienceRequestState)
    })

    it('is idempotent — repeated calls with the same payload do not re-notify subscribers', async () => {
      const core = createCore({ defaults: { consent: true } })
      core.ingestPersonalizationResponse(responseData)
      await Promise.resolve()

      const profileUpdates: Array<string | undefined> = []
      const subscription = core.states.profile.subscribe((value) => {
        profileUpdates.push(value?.id)
      })

      // subscribe fires once with the current value
      expect(profileUpdates).toEqual(['profile-xyz'])

      core.ingestPersonalizationResponse(responseData)
      await Promise.resolve()

      // No additional emission — signal writes are equality-gated.
      expect(profileUpdates).toEqual(['profile-xyz'])

      subscription.unsubscribe()
    })
  })
})
