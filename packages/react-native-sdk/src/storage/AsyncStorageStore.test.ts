import {
  ANONYMOUS_ID_KEY,
  CHANGES_CACHE_KEY,
  CONSENT_KEY,
  DEBUG_FLAG_KEY,
  PERSISTENCE_CONSENT_KEY,
  PROFILE_CACHE_KEY,
  SELECTED_OPTIMIZATIONS_CACHE_KEY,
} from '@contentful/optimization-core/constants'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'

interface AsyncStorageStoreInstance {
  initializeConsentState: () => Promise<void>
  initializeProfileContinuity: () => Promise<void>
  anonymousId: string | undefined
  readonly changes: unknown
  consent: boolean | undefined
  persistenceConsent: boolean | undefined
  readonly profile: unknown
  readonly selectedOptimizations: unknown
  clearProfileContinuity: () => Promise<void>
  drainPersistence: () => Promise<void>
  writeConsentState: (state: {
    consent: boolean | undefined
    persistenceConsent: boolean | undefined
  }) => Promise<void>
  writeProfileContinuity: (state: {
    changes: unknown
    profile: { id?: string } | undefined
    selectedOptimizations: unknown
  }) => Promise<void>
}

const asyncStorageMock = {
  multiGet: rs.fn(),
  multiRemove: rs.fn(),
  multiSet: rs.fn(),
}

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}))

function isAsyncStorageStoreInstance(value: unknown): value is AsyncStorageStoreInstance {
  if (typeof value !== 'object' || value === null) return false

  const initializeConsentState = Reflect.get(value, 'initializeConsentState')
  const initializeProfileContinuity = Reflect.get(value, 'initializeProfileContinuity')

  return (
    typeof initializeConsentState === 'function' &&
    typeof initializeProfileContinuity === 'function'
  )
}

async function getStore(): Promise<AsyncStorageStoreInstance> {
  const module = await import('./AsyncStorageStore')
  const store: unknown = module.default

  if (!isAsyncStorageStoreInstance(store)) {
    throw new TypeError('Expected AsyncStorageStore default export to be a store instance')
  }

  return store
}

function getCache(store: AsyncStorageStoreInstance): Map<unknown, unknown> {
  const cache: unknown = Reflect.get(store, 'cache')
  if (!(cache instanceof Map)) {
    throw new TypeError('Expected AsyncStorageStore cache to be a Map')
  }

  return cache
}

describe('AsyncStorageStore', () => {
  beforeEach(async () => {
    rs.clearAllMocks()

    asyncStorageMock.multiGet.mockResolvedValue([])
    asyncStorageMock.multiRemove.mockResolvedValue(undefined)
    asyncStorageMock.multiSet.mockResolvedValue(undefined)

    const store = await getStore()
    Reflect.set(store, 'consentStateInitialized', false)
    Reflect.set(store, 'persistenceQueue', Promise.resolve())
    Reflect.set(store, 'profileContinuityInitialized', false)
    const cache = getCache(store)
    cache.clear()
  })

  it('loads only consent state during consent initialization', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([
      [CONSENT_KEY, 'accepted'],
      [PERSISTENCE_CONSENT_KEY, 'denied'],
      [PROFILE_CACHE_KEY, JSON.stringify({ foo: 'bar' })],
    ])

    const store = await getStore()
    await store.initializeConsentState()

    expect(asyncStorageMock.multiGet).toHaveBeenCalledWith([
      CONSENT_KEY,
      PERSISTENCE_CONSENT_KEY,
      DEBUG_FLAG_KEY,
    ])
    expect(store.consent).toBe(true)
    expect(store.persistenceConsent).toBe(false)
    expect(store.profile).toBeUndefined()
    expect(asyncStorageMock.multiRemove).not.toHaveBeenCalledWith([PROFILE_CACHE_KEY])
  })

  it('deletes malformed JSON cache values during profile-continuity initialization', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([[CHANGES_CACHE_KEY, '{bad-json']])

    const store = await getStore()
    await store.initializeProfileContinuity()

    expect(store.changes).toBeUndefined()
    await store.drainPersistence()
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([CHANGES_CACHE_KEY])
  })

  it('deletes cache values that fail schema validation during profile-continuity initialization', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([
      [PROFILE_CACHE_KEY, JSON.stringify({ foo: 'bar' })],
    ])

    const store = await getStore()
    await store.initializeProfileContinuity()

    expect(store.profile).toBeUndefined()
    await store.drainPersistence()
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([PROFILE_CACHE_KEY])
  })

  it('deletes in-memory structured cache values that fail schema validation', async () => {
    const store = await getStore()
    const cache = getCache(store)

    cache.set(SELECTED_OPTIMIZATIONS_CACHE_KEY, { foo: 'bar' })

    expect(store.selectedOptimizations).toBeUndefined()
    await store.drainPersistence()
    expect(cache.has(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBe(false)
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([SELECTED_OPTIMIZATIONS_CACHE_KEY])
  })

  it('swallows AsyncStorage.removeItem failures when invalidating bad cache', async () => {
    asyncStorageMock.multiRemove.mockRejectedValueOnce(new Error('storage blocked'))

    const store = await getStore()
    const cache = getCache(store)

    cache.set(SELECTED_OPTIMIZATIONS_CACHE_KEY, { foo: 'bar' })

    expect(() => {
      void store.selectedOptimizations
    }).not.toThrow()
    await store.drainPersistence()
    expect(cache.has(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBe(false)
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([SELECTED_OPTIMIZATIONS_CACHE_KEY])
  })

  it('translates persistence consent and falls back to accepted legacy consent', async () => {
    const store = await getStore()

    store.persistenceConsent = true
    await store.drainPersistence()
    expect(asyncStorageMock.multiSet).toHaveBeenCalledWith([[PERSISTENCE_CONSENT_KEY, 'accepted']])
    expect(store.persistenceConsent).toBe(true)

    store.persistenceConsent = false
    await store.drainPersistence()
    expect(asyncStorageMock.multiSet).toHaveBeenCalledWith([[PERSISTENCE_CONSENT_KEY, 'denied']])
    expect(store.persistenceConsent).toBe(false)

    store.persistenceConsent = undefined
    store.consent = true
    await store.drainPersistence()
    expect(store.persistenceConsent).toBe(true)
  })

  it('clears profile-continuity keys without clearing consent keys', async () => {
    const store = await getStore()
    const cache = getCache(store)

    cache.set(ANONYMOUS_ID_KEY, 'profile-id')
    cache.set(CHANGES_CACHE_KEY, [])
    cache.set(PROFILE_CACHE_KEY, {})
    cache.set(SELECTED_OPTIMIZATIONS_CACHE_KEY, [])
    cache.set(CONSENT_KEY, 'accepted')
    cache.set(PERSISTENCE_CONSENT_KEY, 'accepted')

    await store.clearProfileContinuity()

    expect(cache.has(ANONYMOUS_ID_KEY)).toBe(false)
    expect(cache.has(CHANGES_CACHE_KEY)).toBe(false)
    expect(cache.has(PROFILE_CACHE_KEY)).toBe(false)
    expect(cache.has(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBe(false)
    expect(cache.get(CONSENT_KEY)).toBe('accepted')
    expect(cache.get(PERSISTENCE_CONSENT_KEY)).toBe('accepted')
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([
      ANONYMOUS_ID_KEY,
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
  })

  it('batches profile-continuity writes through AsyncStorage.multiSet', async () => {
    const store = await getStore()
    const profile = { id: 'profile-id' }

    await store.writeProfileContinuity({
      changes: [],
      profile,
      selectedOptimizations: [],
    })

    expect(asyncStorageMock.multiSet).toHaveBeenCalledWith([
      [ANONYMOUS_ID_KEY, 'profile-id'],
      [CHANGES_CACHE_KEY, '[]'],
      [PROFILE_CACHE_KEY, JSON.stringify(profile)],
      [SELECTED_OPTIMIZATIONS_CACHE_KEY, '[]'],
    ])
  })

  it('serializes profile-continuity writes so later clears win', async () => {
    const store = await getStore()
    let resolveFirstWrite: (() => void) | undefined

    asyncStorageMock.multiSet.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        resolveFirstWrite = resolve
      })
    })

    const write = store.writeProfileContinuity({
      changes: [],
      profile: { id: 'profile-id' },
      selectedOptimizations: [],
    })
    const clear = store.clearProfileContinuity()

    await Promise.resolve()
    await Promise.resolve()
    expect(asyncStorageMock.multiSet).toHaveBeenCalledTimes(1)
    expect(asyncStorageMock.multiRemove).not.toHaveBeenCalled()

    resolveFirstWrite?.()
    await Promise.all([write, clear])

    expect(asyncStorageMock.multiRemove).toHaveBeenLastCalledWith([
      ANONYMOUS_ID_KEY,
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
  })
})
