import { batch, signals } from '@contentful/optimization-core'
import {
  CONSENT_KEY,
  PERSISTENCE_CONSENT_KEY,
  PROFILE_CACHE_KEY,
} from '@contentful/optimization-core/constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { profile as profileFixture } from '../../universal/core-sdk/src/test/fixtures/profile'
import ContentfulOptimization from './ContentfulOptimization'
import AsyncStorageStore from './storage/AsyncStorageStore'

const config = {
  spaceId: 'test-space-id',
  environment: 'main',
  defaults: { consent: true, profile: profileFixture },
}

describe('React Native consent lifecycle', () => {
  const instances: ContentfulOptimization[] = []
  const subscriptions: Array<{ unsubscribe: () => void }> = []

  const initialize = async (): Promise<ContentfulOptimization> => {
    const instance = await ContentfulOptimization.initialize(config)
    instances.push(instance)
    return instance
  }

  beforeEach(async () => {
    await AsyncStorageStore.drainPersistence()
    const cache: unknown = Reflect.get(AsyncStorageStore, 'cache')
    if (cache instanceof Map) cache.clear()
    Reflect.set(AsyncStorageStore, 'consentStateInitialized', false)
    Reflect.set(AsyncStorageStore, 'profileContinuityInitialized', false)
    batch(() => {
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.changes.value = undefined
      signals.selectedOptimizations.value = undefined
      signals.online.value = true
    })
  })

  afterEach(async () => {
    for (const subscription of subscriptions.splice(0)) subscription.unsubscribe()
    for (const instance of instances.splice(0)) instance.destroy()
    await AsyncStorageStore.drainPersistence()
    rs.restoreAllMocks()
  })

  it('persists explicit denial and clears continuity before a consent subscriber throws', async () => {
    const instance = await initialize()
    const setMany = rs.spyOn(AsyncStorage, 'setMany')
    const removeMany = rs.spyOn(AsyncStorage, 'removeMany')
    subscriptions.push(
      instance.states.consent.subscribe((consent) => {
        if (consent === false) throw new Error('Consent observer failed')
      }),
    )

    expect(() => {
      instance.consent(false)
    }).toThrow('Consent observer failed')
    await AsyncStorageStore.drainPersistence()

    expect(AsyncStorageStore.consent).toBe(false)
    expect(AsyncStorageStore.persistenceConsent).toBe(false)
    expect(AsyncStorageStore.profile).toBeUndefined()
    expect(setMany).toHaveBeenCalledWith({
      [CONSENT_KEY]: 'denied',
      [PERSISTENCE_CONSENT_KEY]: 'denied',
    })
    expect(removeMany).toHaveBeenCalledWith(expect.arrayContaining([PROFILE_CACHE_KEY]))
  })

  it('enqueues explicit denial before a consent subscriber destroys the runtime', async () => {
    const instance = await initialize()
    let persistedConsentAtDestroy: boolean | undefined
    subscriptions.push(
      instance.states.consent.subscribe((consent) => {
        if (consent !== false) return
        persistedConsentAtDestroy = AsyncStorageStore.consent
        instance.destroy()
      }),
    )

    instance.consent(false)
    await AsyncStorageStore.drainPersistence()

    expect(persistedConsentAtDestroy).toBe(false)
    expect(AsyncStorageStore.consent).toBe(false)
    expect(AsyncStorageStore.profile).toBeUndefined()
  })

  it('does not let destroyed overrides write or clear replacement continuity', async () => {
    const previous = await initialize()
    previous.destroy()
    const replacement = await initialize()
    const writeConsent = rs.spyOn(AsyncStorageStore, 'writeConsentState')
    const clearContinuity = rs.spyOn(AsyncStorageStore, 'clearProfileContinuity')

    previous.consent(false)
    previous.reset()
    await AsyncStorageStore.drainPersistence()

    expect(writeConsent).not.toHaveBeenCalled()
    expect(clearContinuity).not.toHaveBeenCalled()
    expect(replacement.states.profile.current).toEqual(profileFixture)
    expect(AsyncStorageStore.profile).toEqual(profileFixture)
  })

  it('allows the same current screen after withdrawal purges its offline event', async () => {
    const instance = await initialize()
    const upsertProfile = rs.spyOn(instance.api.experience, 'upsertProfile').mockResolvedValue({
      changes: [],
      profile: profileFixture,
      selectedOptimizations: [],
    })
    signals.online.value = false
    expect(
      await instance.trackCurrentScreen({ routeKey: 'home', name: 'Home', properties: {} }),
    ).toEqual({
      accepted: true,
    })

    instance.consent({ events: false })
    instance.consent({ events: true })
    signals.online.value = true
    const result = await instance.trackCurrentScreen({
      routeKey: 'home',
      name: 'Home',
      properties: {},
    })

    expect(result.accepted).toBe(true)
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })
})
