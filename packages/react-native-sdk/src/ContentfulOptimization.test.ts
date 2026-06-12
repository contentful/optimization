import { batch, signals } from '@contentful/optimization-core'
import type { OptimizationData, Profile } from '@contentful/optimization-core/api-schemas'
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

let appStateChangeHandler: ((nextAppState: string) => void) | undefined = undefined

rs.mock('react-native', () => ({
  AppState: {
    addEventListener: rs.fn((_event: string, handler: (nextAppState: string) => void) => {
      appStateChangeHandler = handler
      return {
        remove: rs.fn(),
      }
    }),
  },
  Dimensions: { get: rs.fn(() => ({ width: 375, height: 667 })) },
  NativeModules: {},
  Platform: { OS: 'ios' },
}))

const asyncStorageMock = {
  getItem: rs.fn(),
  multiGet: rs.fn().mockResolvedValue([]),
  multiRemove: rs.fn().mockResolvedValue(undefined),
  multiSet: rs.fn().mockResolvedValue(undefined),
}

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.getItem,
    multiGet: asyncStorageMock.multiGet,
    multiRemove: asyncStorageMock.multiRemove,
    multiSet: asyncStorageMock.multiSet,
  },
}))

rs.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: rs.fn(() => () => undefined),
  },
}))

const DEFAULT_PROFILE: Profile = {
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

const IDENTIFIED_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  id: 'identified-profile-id',
  stableId: 'identified-profile-id',
  traits: { identified: true },
}

const IDENTIFIED_OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  profile: IDENTIFIED_PROFILE,
  selectedOptimizations: [],
}

interface AnonymousIdProvider {
  getAnonymousId: () => string | undefined
}

interface AsyncStorageStoreForTest {
  drainPersistence: () => Promise<void>
}

function hasAnonymousIdProvider(value: unknown): value is AnonymousIdProvider {
  if (typeof value !== 'object' || value === null) return false

  const getAnonymousId = Reflect.get(value, 'getAnonymousId') as unknown

  return typeof getAnonymousId === 'function'
}

async function resetAsyncStorageStore(): Promise<void> {
  const module = await import('./storage/AsyncStorageStore')
  const store = module.default

  const cache: unknown = Reflect.get(store, 'cache')

  Reflect.set(store, 'consentStateInitialized', false)
  Reflect.set(store, 'persistenceQueue', Promise.resolve())
  Reflect.set(store, 'profileContinuityInitialized', false)
  if (cache instanceof Map) cache.clear()
}

async function getAsyncStorageStore(): Promise<AsyncStorageStoreForTest> {
  const module = await import('./storage/AsyncStorageStore')
  return module.default
}

async function drainAsyncStorageStore(): Promise<void> {
  const store = await getAsyncStorageStore()
  await store.drainPersistence()
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let deferredResolve: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    deferredResolve = resolve
  })

  return {
    promise,
    resolve: () => {
      deferredResolve?.()
    },
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function hasProfileCacheEntry(entries: ReadonlyArray<[string, string]>): boolean {
  return entries.some(([key]) => key === PROFILE_CACHE_KEY)
}

function isStorageEntries(value: unknown): value is ReadonlyArray<[string, string]> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry): entry is [string, string] =>
        Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string',
    )
  )
}

function getProfileWriteCalls(): Array<ReadonlyArray<[string, string]>> {
  const calls: unknown = asyncStorageMock.multiSet.mock.calls
  if (!Array.isArray(calls)) return []

  const entries = calls
    .filter((call): call is readonly [unknown, ...unknown[]] => Array.isArray(call))
    .map(([value]) => value)

  return entries.filter(isStorageEntries).filter(hasProfileCacheEntry)
}

function getAppStateChangeHandler(): (nextAppState: string) => void {
  if (!appStateChangeHandler) {
    throw new Error('Expected AppState change handler to be registered')
  }

  return appStateChangeHandler
}

describe('ContentfulOptimization locale resolution', () => {
  let optimization: { destroy: () => void } | undefined

  beforeEach(async () => {
    await resetAsyncStorageStore()
    appStateChangeHandler = undefined
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.locale.value = undefined
      signals.online.value = true
      signals.persistenceConsent.value = undefined
      signals.previewPanelAttached.value = false
      signals.previewPanelOpen.value = false
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
    })
    asyncStorageMock.multiGet.mockResolvedValue([])
    asyncStorageMock.multiRemove.mockResolvedValue(undefined)
    asyncStorageMock.multiSet.mockResolvedValue(undefined)
  })

  afterEach(() => {
    optimization?.destroy()
    optimization = undefined
    rs.clearAllMocks()
  })

  it('uses top-level locale as the SDK Experience API/event locale', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      locale: ' de_DE ',
    })
    optimization = created

    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('de-DE')
    expect(
      created.eventBuilder.buildScreenView({ name: 'Home', properties: {} }).context.locale,
    ).toBe('de-DE')
  })

  it('omits the Experience API locale when top-level locale is omitted', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(created.locale).toBeUndefined()
    expect(Reflect.get(created.api.experience, 'locale')).toBeUndefined()
  })

  it('updates live locale without refreshing optimization data', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      locale: 'en-US',
    })
    optimization = created
    const screen = rs.spyOn(created, 'screen')

    expect(created.setLocale(' de_DE ')).toBe('de-DE')
    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('de-DE')
    expect(screen).not.toHaveBeenCalled()
  })

  it('defaults allowedEventTypes to identify/screen for React Native', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(Reflect.get(created, 'allowedEventTypes')).toEqual(['identify', 'screen'])
  })

  it('keeps explicit default profile in memory until persistence consent is granted', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: {
        profile: DEFAULT_PROFILE,
      },
    })
    optimization = created

    expect(created.states.profile.current).toEqual(DEFAULT_PROFILE)
    expect(getProfileWriteCalls()).toHaveLength(0)

    created.consent({ persistence: true })
    await drainAsyncStorageStore()

    expect(getProfileWriteCalls()).toEqual([
      expect.arrayContaining([[PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE)]]),
    ])
  })

  it('does not load persisted profile continuity when persistence consent is denied', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([
      [PERSISTENCE_CONSENT_KEY, 'denied'],
      [PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE)],
    ])
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(created.states.profile.current).toBeUndefined()
    expect(asyncStorageMock.multiGet).toHaveBeenCalledWith([
      CONSENT_KEY,
      PERSISTENCE_CONSENT_KEY,
      DEBUG_FLAG_KEY,
    ])
    expect(asyncStorageMock.multiGet).not.toHaveBeenCalledWith([
      ANONYMOUS_ID_KEY,
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([
      ANONYMOUS_ID_KEY,
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
  })

  it('loads persisted profile continuity when persistence consent is accepted', async () => {
    asyncStorageMock.multiGet.mockImplementation(async (keys: string[]) => {
      if (keys.includes(PROFILE_CACHE_KEY)) {
        return await Promise.resolve([[PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE)]])
      }

      return await Promise.resolve([[PERSISTENCE_CONSENT_KEY, 'accepted']])
    })
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(asyncStorageMock.multiGet).toHaveBeenNthCalledWith(1, [
      CONSENT_KEY,
      PERSISTENCE_CONSENT_KEY,
      DEBUG_FLAG_KEY,
    ])
    expect(asyncStorageMock.multiGet).toHaveBeenNthCalledWith(2, [
      ANONYMOUS_ID_KEY,
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
    expect(created.states.profile.current).toEqual(DEFAULT_PROFILE)
  })

  it('uses stored anonymous ID only while persistence consent is accepted', async () => {
    asyncStorageMock.multiGet.mockImplementation(async (keys: string[]) => {
      if (keys.includes(ANONYMOUS_ID_KEY)) {
        return await Promise.resolve([[ANONYMOUS_ID_KEY, 'stored-anonymous-id']])
      }

      return await Promise.resolve([[PERSISTENCE_CONSENT_KEY, 'accepted']])
    })
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    const experienceQueue = Reflect.get(created, 'experienceQueue') as unknown

    expect(hasAnonymousIdProvider(experienceQueue)).toBe(true)
    if (!hasAnonymousIdProvider(experienceQueue)) throw new Error('Missing anonymous ID provider')

    const { getAnonymousId } = experienceQueue

    expect(getAnonymousId()).toBe('stored-anonymous-id')

    created.consent({ persistence: false })

    expect(getAnonymousId()).toBeUndefined()
  })

  it('waits for profile-continuity persistence before publishing identified state', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created

    asyncStorageMock.multiSet.mockClear()
    const profileWrite = createDeferred()
    asyncStorageMock.multiSet.mockImplementation(
      async (entries: ReadonlyArray<[string, string]>) => {
        if (hasProfileCacheEntry(entries)) await profileWrite.promise
      },
    )
    rs.spyOn(created.api.experience, 'upsertProfile').mockResolvedValue(
      IDENTIFIED_OPTIMIZATION_DATA,
    )

    let identifyResolved = false
    const identify = created.identify({ userId: 'known-user' }).then(() => {
      identifyResolved = true
    })

    await flushPromises()

    expect(created.states.profile.current).toBeUndefined()
    expect(identifyResolved).toBe(false)

    profileWrite.resolve()
    await identify

    expect(created.states.profile.current).toEqual(IDENTIFIED_PROFILE)
    expect(getProfileWriteCalls()).toEqual([
      expect.arrayContaining([
        [ANONYMOUS_ID_KEY, IDENTIFIED_PROFILE.id],
        [PROFILE_CACHE_KEY, JSON.stringify(IDENTIFIED_PROFILE)],
      ]),
    ])
  })

  it('publishes identified state after failed profile-continuity persistence is handled', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created

    asyncStorageMock.multiSet.mockImplementation(
      async (entries: ReadonlyArray<[string, string]>) => {
        if (hasProfileCacheEntry(entries)) {
          await Promise.resolve()
          throw new Error('storage blocked')
        }
      },
    )
    rs.spyOn(created.api.experience, 'upsertProfile').mockResolvedValue(
      IDENTIFIED_OPTIMIZATION_DATA,
    )

    await expect(created.identify({ userId: 'known-user' })).resolves.toEqual(
      IDENTIFIED_OPTIMIZATION_DATA,
    )
    expect(created.states.profile.current).toEqual(IDENTIFIED_PROFILE)
  })

  it('drains pending AsyncStorage persistence when the app backgrounds', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')
    const store = await getAsyncStorageStore()

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created
    const flush = rs.spyOn(created, 'flush').mockResolvedValue(undefined)
    const drainPersistence = rs.spyOn(store, 'drainPersistence').mockResolvedValue(undefined)

    getAppStateChangeHandler()('background')
    await flushPromises()

    expect(flush).toHaveBeenCalled()
    expect(drainPersistence).toHaveBeenCalled()
  })
})
