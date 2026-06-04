import {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-core/api-schemas'
import {
  ANONYMOUS_ID_KEY,
  CHANGES_CACHE_KEY,
  CONSENT_KEY,
  DEBUG_FLAG_KEY,
  PERSISTENCE_CONSENT_KEY,
  PROFILE_CACHE_KEY,
  SELECTED_OPTIMIZATIONS_CACHE_KEY,
} from '@contentful/optimization-core/constants'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { z } from 'zod/mini'

const logger = createScopedLogger('RN:Storage')
const STRUCTURED_CACHE_PARSERS: Record<string, z.ZodMiniType> = {
  [CHANGES_CACHE_KEY]: ChangeArray,
  [PROFILE_CACHE_KEY]: Profile,
  [SELECTED_OPTIMIZATIONS_CACHE_KEY]: SelectedOptimizationArray,
}
const STRING_CACHE_KEYS = new Set([
  ANONYMOUS_ID_KEY,
  CONSENT_KEY,
  DEBUG_FLAG_KEY,
  PERSISTENCE_CONSENT_KEY,
])
const CONSENT_STATE_KEYS = [CONSENT_KEY, PERSISTENCE_CONSENT_KEY, DEBUG_FLAG_KEY]
const PROFILE_CONTINUITY_KEYS = [
  ANONYMOUS_ID_KEY,
  CHANGES_CACHE_KEY,
  PROFILE_CACHE_KEY,
  SELECTED_OPTIMIZATIONS_CACHE_KEY,
]

interface ProfileContinuityState {
  changes: ChangeArray | undefined
  profile: Profile | undefined
  selectedOptimizations: SelectedOptimizationArray | undefined
}

interface ConsentState {
  consent: boolean | undefined
  persistenceConsent: boolean | undefined
}

type CacheEntry = readonly [key: string, data: unknown]

async function removeKeys(keys: readonly string[], label: string): Promise<void> {
  if (keys.length === 0) return

  try {
    await AsyncStorage.multiRemove([...keys])
  } catch (error: unknown) {
    logger.error(`Failed to remove ${keys.join(', ')} from ${label}:`, error)
  }
}

async function setEntries(entries: ReadonlyArray<[string, string]>): Promise<void> {
  if (entries.length === 0) return

  try {
    await AsyncStorage.multiSet([...entries])
  } catch (error: unknown) {
    logger.error(`Failed to set ${entries.map(([key]) => key).join(', ')} in AsyncStorage:`, error)
  }
}

function translateConsent(consent: boolean | undefined): string | undefined {
  if (consent === undefined) return undefined
  return consent ? 'accepted' : 'denied'
}

/**
 * Persistent storage adapter backed by `@react-native-async-storage/async-storage`.
 *
 * Provides in-memory caching with write-through to AsyncStorage for SDK state
 * such as profile, changes, consent, and selected optimizations.
 *
 * @internal
 */
class AsyncStorageStore {
  private readonly cache = new Map<string, unknown>()
  private consentStateInitialized = false
  private persistenceQueue: Promise<void> = Promise.resolve()
  private profileContinuityInitialized = false

  /**
   * Loads consent, persistence consent, and debug preference state into memory.
   *
   * @returns A promise that resolves when initialization is complete
   *
   * @internal
   */
  async initializeConsentState(): Promise<void> {
    if (this.consentStateInitialized) return

    try {
      await this.drainPersistence()
      await this.loadKeys(CONSENT_STATE_KEYS)
      this.consentStateInitialized = true
    } catch (error: unknown) {
      logger.error('Failed to initialize AsyncStorageStore consent state:', error)
    }
  }

  /**
   * Loads profile-continuity state into memory after persistence consent allows it.
   *
   * @returns A promise that resolves when initialization is complete
   *
   * @internal
   */
  async initializeProfileContinuity(): Promise<void> {
    if (this.profileContinuityInitialized) return

    try {
      await this.drainPersistence()
      await this.loadKeys(PROFILE_CONTINUITY_KEYS)
      this.profileContinuityInitialized = true
    } catch (error: unknown) {
      logger.error('Failed to initialize AsyncStorageStore profile continuity:', error)
    }
  }

  /**
   * @returns The stored anonymous user identifier, or `undefined` if not set
   */
  get anonymousId(): string | undefined {
    const value = this.cache.get(ANONYMOUS_ID_KEY)
    return typeof value === 'string' ? value : undefined
  }

  set anonymousId(id: string | undefined) {
    void this.setCache(ANONYMOUS_ID_KEY, id)
  }

  /**
   * @returns The stored consent state: `true` for accepted, `false` for denied, `undefined` if unset
   */
  get consent(): boolean | undefined {
    const value = this.cache.get(CONSENT_KEY)
    const consent = typeof value === 'string' ? value : undefined

    switch (consent) {
      case 'accepted':
        return true
      case 'denied':
        return false
      default:
        return undefined
    }
  }

  set consent(consent: boolean | undefined) {
    const translated = consent ? 'accepted' : 'denied'
    void this.setCache(CONSENT_KEY, consent === undefined ? undefined : translated)
  }

  get persistenceConsent(): boolean | undefined {
    const value = this.cache.get(PERSISTENCE_CONSENT_KEY)
    const consent = typeof value === 'string' ? value : undefined

    switch (consent) {
      case 'accepted':
        return true
      case 'denied':
        return false
      default:
        return this.consent === true ? true : undefined
    }
  }

  set persistenceConsent(consent: boolean | undefined) {
    const translated = consent ? 'accepted' : 'denied'
    void this.setCache(PERSISTENCE_CONSENT_KEY, consent === undefined ? undefined : translated)
  }

  /**
   * @returns Whether the debug flag is set
   */
  get debug(): boolean | undefined {
    const value = this.cache.get(DEBUG_FLAG_KEY)
    const debug = typeof value === 'string' ? value : undefined
    return debug ? debug === 'true' : undefined
  }

  set debug(debug: boolean | undefined) {
    void this.setCache(DEBUG_FLAG_KEY, debug)
  }

  /**
   * @returns The cached change array, or `undefined` if not present
   */
  get changes(): ChangeArray | undefined {
    return this.getCache(CHANGES_CACHE_KEY, ChangeArray)
  }

  set changes(changes: ChangeArray | undefined) {
    void this.setCache(CHANGES_CACHE_KEY, changes)
  }

  /**
   * @returns The cached user profile, or `undefined` if not present
   */
  get profile(): Profile | undefined {
    return this.getCache(PROFILE_CACHE_KEY, Profile)
  }

  set profile(profile: Profile | undefined) {
    void this.setCache(PROFILE_CACHE_KEY, profile)
  }

  /**
   * @returns The cached selected optimizations, or `undefined` if not present
   */
  get selectedOptimizations(): SelectedOptimizationArray | undefined {
    return this.getCache(SELECTED_OPTIMIZATIONS_CACHE_KEY, SelectedOptimizationArray)
  }

  set selectedOptimizations(selectedOptimizations: SelectedOptimizationArray | undefined) {
    void this.setCache(SELECTED_OPTIMIZATIONS_CACHE_KEY, selectedOptimizations)
  }

  async writeConsentState({ consent, persistenceConsent }: ConsentState): Promise<void> {
    await this.setCacheEntries([
      [CONSENT_KEY, translateConsent(consent)],
      [PERSISTENCE_CONSENT_KEY, translateConsent(persistenceConsent)],
    ])
  }

  async writeProfileContinuity({
    changes,
    profile,
    selectedOptimizations,
  }: ProfileContinuityState): Promise<void> {
    await this.setCacheEntries([
      [ANONYMOUS_ID_KEY, profile?.id ?? this.anonymousId],
      [CHANGES_CACHE_KEY, changes],
      [PROFILE_CACHE_KEY, profile],
      [SELECTED_OPTIMIZATIONS_CACHE_KEY, selectedOptimizations],
    ])
  }

  async clearProfileContinuity(): Promise<void> {
    await this.setCacheEntries(PROFILE_CONTINUITY_KEYS.map((key) => [key, undefined] as const))
  }

  async drainPersistence(): Promise<void> {
    await this.persistenceQueue
  }

  getCache<T extends z.ZodMiniType>(key: string, parser: T): z.output<T> | undefined {
    const cacheValue = this.cache.get(key)

    if (!cacheValue) return

    const parsedCache = parser.safeParse(cacheValue)
    if (parsedCache.success) return parsedCache.data

    this.invalidateCacheKey(key, 'schema validation failed')
    return undefined
  }

  async setCache(key: string, data: unknown): Promise<void> {
    await this.setCacheEntries([[key, data]])
  }

  private invalidateCacheKey(key: string, reason: string): void {
    this.cache.delete(key)
    void this.enqueuePersistence(async () => {
      await removeKeys([key], `invalid ${key} from AsyncStorage (${reason})`)
    })
  }

  private async enqueuePersistence(operation: () => Promise<void>): Promise<void> {
    const queued = this.persistenceQueue.then(operation, operation)
    this.persistenceQueue = queued.catch(() => undefined)
    await queued
  }

  private async setCacheEntries(entries: readonly CacheEntry[]): Promise<void> {
    const keysToRemove: string[] = []
    const entriesToSet: Array<[string, string]> = []

    for (const [key, data] of entries) {
      if (data === undefined) {
        this.cache.delete(key)
        keysToRemove.push(key)
        continue
      }

      this.cache.set(key, data)
      entriesToSet.push([key, typeof data === 'string' ? data : JSON.stringify(data)])
    }

    await this.enqueuePersistence(async () => {
      await removeKeys(keysToRemove, 'AsyncStorage')
      await setEntries(entriesToSet)
    })
  }

  private async loadKeys(keys: readonly string[]): Promise<void> {
    const values = await AsyncStorage.multiGet(keys)
    const requestedKeys = new Set(keys)

    for (const [key, value] of values) {
      if (!requestedKeys.has(key)) continue
      if (!value) continue

      if (STRING_CACHE_KEYS.has(key)) {
        this.cache.set(key, value)
        continue
      }

      const { [key]: parser } = STRUCTURED_CACHE_PARSERS
      if (!parser) continue

      let json: unknown = undefined
      try {
        json = JSON.parse(value)
      } catch {
        this.invalidateCacheKey(key, 'malformed JSON')
        continue
      }

      const parsed = parser.safeParse(json)
      if (parsed.success) {
        this.cache.set(key, parsed.data)
      } else {
        this.invalidateCacheKey(key, 'schema validation failed')
      }
    }
  }
}

const store = new AsyncStorageStore()

export default store
