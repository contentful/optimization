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
const removeAppStateChangeListener = rs.fn()
const addAppStateChangeListener = rs.fn(
  (_event: string, handler: (nextAppState: string) => void) => {
    appStateChangeHandler = handler
    return {
      remove: removeAppStateChangeListener,
    }
  },
)

rs.mock('react-native', () => ({
  AppState: {
    addEventListener: addAppStateChangeListener,
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

const removeOnlineChangeListener = rs.fn()
const addOnlineChangeListener = rs.fn(() => removeOnlineChangeListener)

rs.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: addOnlineChangeListener,
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

const LATEST_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  id: 'latest-profile-id',
  stableId: 'latest-profile-id',
  traits: { latest: true },
}

const LATEST_OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  profile: LATEST_PROFILE,
  selectedOptimizations: [],
}

interface AsyncStorageStoreForTest {
  drainPersistence: () => Promise<void>
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

function createValueDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let deferredResolve: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    deferredResolve = resolve
  })

  return {
    promise,
    resolve: (value) => {
      deferredResolve?.(value)
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

function hasProfileRemoveCall(): boolean {
  const calls: unknown = asyncStorageMock.multiRemove.mock.calls
  if (!Array.isArray(calls)) return false

  return calls.some((call) => {
    if (!Array.isArray(call)) return false

    const [keys] = call
    return Array.isArray(keys) && keys.includes(PROFILE_CACHE_KEY)
  })
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

    const created = await ContentfulOptimization.initialize({
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

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(created.locale).toBeUndefined()
    expect(Reflect.get(created.api.experience, 'locale')).toBeUndefined()
  })

  it('updates live locale without refreshing optimization data', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
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

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created

    expect(Reflect.get(created, 'allowedEventTypes')).toEqual(['identify', 'screen'])
  })

  it('keeps explicit default profile in memory until persistence consent is granted', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
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

    const created = await ContentfulOptimization.initialize({
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

    const created = await ContentfulOptimization.initialize({
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

  it('persists profileless selection state without clearing stored profile continuity', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: {
        consent: true,
        persistenceConsent: true,
        profile: DEFAULT_PROFILE,
      },
    })
    optimization = created

    asyncStorageMock.multiRemove.mockClear()
    asyncStorageMock.multiSet.mockClear()

    signals.experienceRequestState.value = { status: 'pending' }
    await created.interceptors.state.run({
      changes: [],
      selectedOptimizations: [],
    })
    signals.experienceRequestState.value = { status: 'success' }
    await drainAsyncStorageStore()

    expect(hasProfileRemoveCall()).toBe(false)
    expect(asyncStorageMock.multiSet).toHaveBeenCalledWith(
      expect.arrayContaining([
        [CHANGES_CACHE_KEY, JSON.stringify([])],
        [PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE)],
        [SELECTED_OPTIMIZATIONS_CACHE_KEY, JSON.stringify([])],
      ]),
    )
  })

  it('clears stored selection continuity fields when state owns undefined values', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: {
        changes: [],
        consent: true,
        persistenceConsent: true,
        profile: DEFAULT_PROFILE,
        selectedOptimizations: [],
      },
    })
    optimization = created

    asyncStorageMock.multiRemove.mockClear()
    asyncStorageMock.multiSet.mockClear()

    signals.experienceRequestState.value = { status: 'pending' }
    await created.interceptors.state.run({
      changes: undefined,
      profile: undefined,
      selectedOptimizations: undefined,
    })
    signals.experienceRequestState.value = { status: 'success' }
    await drainAsyncStorageStore()

    expect(asyncStorageMock.multiRemove).toHaveBeenCalledWith([
      CHANGES_CACHE_KEY,
      PROFILE_CACHE_KEY,
      SELECTED_OPTIMIZATIONS_CACHE_KEY,
    ])
    expect(asyncStorageMock.multiSet).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        [CHANGES_CACHE_KEY, JSON.stringify([])],
        [PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE)],
        [SELECTED_OPTIMIZATIONS_CACHE_KEY, JSON.stringify([])],
      ]),
    )
  })

  it('uses stored anonymous ID only while persistence consent is accepted', async () => {
    asyncStorageMock.multiGet.mockImplementation(async (keys: string[]) => {
      if (keys.includes(ANONYMOUS_ID_KEY)) {
        return await Promise.resolve([[ANONYMOUS_ID_KEY, 'stored-anonymous-id']])
      }

      return await Promise.resolve([[PERSISTENCE_CONSENT_KEY, 'accepted']])
    })
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created
    const upsertProfile = rs
      .spyOn(created.api.experience, 'upsertProfile')
      .mockResolvedValue(IDENTIFIED_OPTIMIZATION_DATA)

    await created.identify({ userId: 'known-user' })
    expect(upsertProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ profileId: 'stored-anonymous-id' }),
    )

    created.consent({ persistence: false })
    await created.identify({ userId: 'known-user' })

    expect(upsertProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ profileId: IDENTIFIED_PROFILE.id }),
    )
  })

  it('publishes intercepted state and resolves before raw-state persistence settles', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created

    asyncStorageMock.multiSet.mockClear()
    const profileWrite = createDeferred()
    const profileWriteStarted = createDeferred()
    asyncStorageMock.multiSet.mockImplementation(
      async (entries: ReadonlyArray<[string, string]>) => {
        if (hasProfileCacheEntry(entries)) {
          profileWriteStarted.resolve()
          await profileWrite.promise
        }
      },
    )
    rs.spyOn(created.api.experience, 'upsertProfile').mockResolvedValue(
      IDENTIFIED_OPTIMIZATION_DATA,
    )
    created.interceptors.state.add((data) => ({ ...data, profile: DEFAULT_PROFILE }))

    const identify = created.identify({ userId: 'known-user' })
    await profileWriteStarted.promise

    expect(created.states.profile.current).toEqual(DEFAULT_PROFILE)
    await expect(identify).resolves.toEqual({
      accepted: true,
      data: IDENTIFIED_OPTIMIZATION_DATA,
    })
    expect(getProfileWriteCalls()).toEqual([
      expect.arrayContaining([
        [ANONYMOUS_ID_KEY, IDENTIFIED_PROFILE.id],
        [PROFILE_CACHE_KEY, JSON.stringify(IDENTIFIED_PROFILE)],
      ]),
    ])

    profileWrite.resolve()
    await drainAsyncStorageStore()
  })

  it('keeps identified state when profile-continuity persistence fails', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
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

    await expect(created.identify({ userId: 'known-user' })).resolves.toEqual({
      accepted: true,
      data: IDENTIFIED_OPTIMIZATION_DATA,
    })
    expect(created.states.profile.current).toEqual(IDENTIFIED_PROFILE)
  })

  it('does not persist a response superseded during a later state interceptor', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created

    asyncStorageMock.multiSet.mockClear()
    const staleInterception = createDeferred()
    const staleInterceptionStarted = createDeferred()
    rs.spyOn(created.api.experience, 'upsertProfile')
      .mockResolvedValueOnce(IDENTIFIED_OPTIMIZATION_DATA)
      .mockResolvedValueOnce(LATEST_OPTIMIZATION_DATA)
    created.interceptors.state.add(async (data) => {
      if (data.profile?.id === IDENTIFIED_PROFILE.id) {
        staleInterceptionStarted.resolve()
        await staleInterception.promise
      }

      return data
    })

    const staleRequest = created.trackCurrentScreen({ name: 'Home', properties: {} })
    await staleInterceptionStarted.promise

    const latestRequest = created.trackCurrentScreen({ name: 'Details', properties: {} })
    await expect(latestRequest).resolves.toEqual({
      accepted: true,
      data: LATEST_OPTIMIZATION_DATA,
    })
    await drainAsyncStorageStore()

    staleInterception.resolve()
    await expect(staleRequest).resolves.toEqual({ accepted: false })
    await drainAsyncStorageStore()

    expect(getProfileWriteCalls()).toEqual([
      expect.arrayContaining([
        [ANONYMOUS_ID_KEY, LATEST_PROFILE.id],
        [PROFILE_CACHE_KEY, JSON.stringify(LATEST_PROFILE)],
      ]),
    ])
  })

  it('drains pending AsyncStorage persistence when the app backgrounds', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')
    const store = await getAsyncStorageStore()

    const created = await ContentfulOptimization.initialize({
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

  it('rolls back earlier React Native resources when listener setup fails', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')
    const store = await getAsyncStorageStore()
    const drainPersistence = rs.spyOn(store, 'drainPersistence')
    addAppStateChangeListener.mockImplementationOnce(() => {
      throw new Error('AppState listener setup failed')
    })

    await expect(
      ContentfulOptimization.initialize({
        clientId: 'test-client-id',
        environment: 'main',
      }),
    ).rejects.toThrowError('AppState listener setup failed')
    await flushPromises()

    expect(addOnlineChangeListener).not.toHaveBeenCalled()
    expect(drainPersistence).toHaveBeenCalled()

    const replacement = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = replacement

    expect(replacement.states.experienceRequestState.current).toEqual({ status: 'idle' })
  })

  it('disposes React Native resources exactly once and allows replacement', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')
    const store = await getAsyncStorageStore()
    const drainPersistence = rs.spyOn(store, 'drainPersistence')
    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = created
    await flushPromises()
    const drainsBeforeDestroy = drainPersistence.mock.calls.length

    created.destroy()
    created.destroy()

    expect(removeAppStateChangeListener).toHaveBeenCalledTimes(1)
    expect(removeOnlineChangeListener).toHaveBeenCalledTimes(1)
    expect(drainPersistence).toHaveBeenCalledTimes(drainsBeforeDestroy + 1)

    const replacement = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
    })
    optimization = replacement
  })

  it('keeps the public current-screen result shape for accepted and deduplicated calls', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created
    const upsertProfile = rs
      .spyOn(created.api.experience, 'upsertProfile')
      .mockResolvedValue(IDENTIFIED_OPTIMIZATION_DATA)

    await expect(created.trackCurrentScreen({ name: 'Home', properties: {} })).resolves.toEqual({
      accepted: true,
      data: IDENTIFIED_OPTIMIZATION_DATA,
    })
    await expect(created.trackCurrentScreen({ name: 'Home', properties: {} })).resolves.toEqual({
      accepted: false,
    })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('requires an explicit current-screen retry after reconnecting', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created
    const upsertProfile = rs
      .spyOn(created.api.experience, 'upsertProfile')
      .mockResolvedValue(IDENTIFIED_OPTIMIZATION_DATA)

    signals.online.value = false
    await expect(created.trackCurrentScreen({ name: 'Home', properties: {} })).resolves.toEqual({
      accepted: false,
    })
    expect(upsertProfile).not.toHaveBeenCalled()

    signals.online.value = true
    await flushPromises()
    expect(upsertProfile).not.toHaveBeenCalled()

    await expect(created.trackCurrentScreen({ name: 'Home', properties: {} })).resolves.toEqual({
      accepted: true,
      data: IDENTIFIED_OPTIMIZATION_DATA,
    })
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('collapses joined and superseded tracker outcomes to the public result shape', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.initialize({
      clientId: 'test-client-id',
      environment: 'main',
      defaults: { consent: true },
    })
    optimization = created
    const homeResult = createValueDeferred<OptimizationData>()
    const detailsResult = createValueDeferred<OptimizationData>()
    const upsertProfile = rs
      .spyOn(created.api.experience, 'upsertProfile')
      .mockReturnValueOnce(homeResult.promise)
      .mockReturnValueOnce(detailsResult.promise)

    const firstHome = created.trackCurrentScreen({ name: 'Home', properties: {} })
    const joinedHome = created.trackCurrentScreen({ name: 'Home', properties: {} })
    await flushPromises()
    const details = created.trackCurrentScreen({ name: 'Details', properties: {} })

    homeResult.resolve(IDENTIFIED_OPTIMIZATION_DATA)
    detailsResult.resolve(IDENTIFIED_OPTIMIZATION_DATA)

    await expect(firstHome).resolves.toEqual({ accepted: false })
    await expect(joinedHome).resolves.toEqual({ accepted: false })
    await expect(details).resolves.toEqual({
      accepted: true,
      data: IDENTIFIED_OPTIMIZATION_DATA,
    })
    expect(upsertProfile).toHaveBeenCalledTimes(2)
  })
})
