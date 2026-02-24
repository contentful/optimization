import {
  ANONYMOUS_ID_KEY,
  ChangeArray,
  CHANGES_CACHE_KEY,
  CONSENT_KEY,
  createScopedLogger,
  DEBUG_FLAG_KEY,
  PERSONALIZATIONS_CACHE_KEY,
  Profile,
  PROFILE_CACHE_KEY,
  SelectedPersonalizationArray,
} from '@contentful/optimization-core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { z } from 'zod/mini'

const logger = createScopedLogger('RN:Storage')

/**
 * Persistent storage adapter backed by `@react-native-async-storage/async-storage`.
 *
 * Provides in-memory caching with write-through to AsyncStorage for SDK state
 * such as profile, changes, consent, and personalizations.
 *
 * @internal
 */
class AsyncStorageStore {
  private readonly cache = new Map<string, unknown>()
  private initialized = false

  /**
   * Loads all known keys from AsyncStorage into the in-memory cache.
   *
   * @returns A promise that resolves when initialization is complete
   *
   * @internal
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const keys = [
        ANONYMOUS_ID_KEY,
        CONSENT_KEY,
        CHANGES_CACHE_KEY,
        DEBUG_FLAG_KEY,
        PROFILE_CACHE_KEY,
        PERSONALIZATIONS_CACHE_KEY,
      ]
      const values = await AsyncStorage.multiGet(keys)

      for (const [key, value] of values) {
        if (value) {
          try {
            this.cache.set(
              key,
              key === ANONYMOUS_ID_KEY || key === CONSENT_KEY || key === DEBUG_FLAG_KEY
                ? value
                : JSON.parse(value),
            )
          } catch {
            this.cache.set(key, value)
          }
        }
      }

      this.initialized = true
    } catch (error: unknown) {
      logger.error('Failed to initialize AsyncStorageStore:', error)
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
    this.setCache(ANONYMOUS_ID_KEY, id)
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
    this.setCache(CONSENT_KEY, consent === undefined ? undefined : translated)
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
    this.setCache(DEBUG_FLAG_KEY, debug)
  }

  /**
   * @returns The cached change array, or `undefined` if not present
   */
  get changes(): ChangeArray | undefined {
    return this.getCache(CHANGES_CACHE_KEY, ChangeArray)
  }

  set changes(changes: ChangeArray | undefined) {
    this.setCache(CHANGES_CACHE_KEY, changes)
  }

  /**
   * @returns The cached user profile, or `undefined` if not present
   */
  get profile(): Profile | undefined {
    return this.getCache(PROFILE_CACHE_KEY, Profile)
  }

  set profile(profile: Profile | undefined) {
    this.setCache(PROFILE_CACHE_KEY, profile)
  }

  /**
   * @returns The cached personalization selections, or `undefined` if not present
   */
  get personalizations(): SelectedPersonalizationArray | undefined {
    return this.getCache(PERSONALIZATIONS_CACHE_KEY, SelectedPersonalizationArray)
  }

  set personalizations(personalizations: SelectedPersonalizationArray | undefined) {
    this.setCache(PERSONALIZATIONS_CACHE_KEY, personalizations)
  }

  getCache<T extends z.ZodMiniType>(key: string, parser: T): z.output<T> | undefined {
    const cacheValue = this.cache.get(key)

    if (!cacheValue) return

    try {
      const parsedCache = parser.safeParse(cacheValue)
      if (parsedCache.success) return parsedCache.data
    } catch {
      // Parsing failed, return undefined
      return undefined
    }
  }

  setCache(key: string, data: unknown): void {
    if (data === undefined) {
      this.cache.delete(key)
      AsyncStorage.removeItem(key).catch((error: unknown) => {
        logger.error(`Failed to remove ${key} from AsyncStorage:`, error)
      })
    } else {
      const value = typeof data === 'string' ? data : JSON.stringify(data)
      this.cache.set(key, typeof data === 'string' ? data : data)
      AsyncStorage.setItem(key, value).catch((error: unknown) => {
        logger.error(`Failed to set ${key} in AsyncStorage:`, error)
      })
    }
  }
}

const store = new AsyncStorageStore()

export default store
