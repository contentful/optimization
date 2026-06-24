import type { ChangeArray, Profile, SelectedOptimizationArray } from './api-schemas'
import { resolveStatefulDefaults } from './StatefulDefaults'

const profile: Profile = {
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
const changes: ChangeArray = []
const selectedOptimizations: SelectedOptimizationArray = []

describe('resolveStatefulDefaults', () => {
  it('prefers configured defaults over persisted values', () => {
    const result = resolveStatefulDefaults(
      {
        consent: false,
        persistenceConsent: true,
        profile,
        changes,
        selectedOptimizations,
      },
      {
        consent: true,
        persistenceConsent: false,
      },
    )

    expect(result).toEqual({
      canLoadPersistedContinuity: true,
      defaults: {
        consent: false,
        persistenceConsent: true,
        profile,
        changes,
        selectedOptimizations,
      },
    })
  })

  it('uses configured consent as the persistence default before persisted persistence consent', () => {
    const result = resolveStatefulDefaults(
      { consent: true },
      { consent: false, persistenceConsent: false },
    )

    expect(result.defaults.consent).toBe(true)
    expect(result.defaults.persistenceConsent).toBe(true)
    expect(result.canLoadPersistedContinuity).toBe(true)
  })

  it('loads persisted continuity only when resolved persistence consent is true', () => {
    const readProfile = rs.fn(() => profile)
    const readChanges = rs.fn(() => changes)
    const readSelectedOptimizations = rs.fn(() => selectedOptimizations)

    const denied = resolveStatefulDefaults(
      {},
      {
        persistenceConsent: false,
        profile: readProfile,
        changes: readChanges,
        selectedOptimizations: readSelectedOptimizations,
      },
    )

    expect(denied.canLoadPersistedContinuity).toBe(false)
    expect(denied.defaults.profile).toBeUndefined()
    expect(readProfile).not.toHaveBeenCalled()
    expect(readChanges).not.toHaveBeenCalled()
    expect(readSelectedOptimizations).not.toHaveBeenCalled()

    const accepted = resolveStatefulDefaults(
      {},
      {
        persistenceConsent: true,
        profile: readProfile,
        changes: readChanges,
        selectedOptimizations: readSelectedOptimizations,
      },
    )

    expect(accepted.canLoadPersistedContinuity).toBe(true)
    expect(accepted.defaults.profile).toBe(profile)
    expect(accepted.defaults.changes).toBe(changes)
    expect(accepted.defaults.selectedOptimizations).toBe(selectedOptimizations)
  })
})
