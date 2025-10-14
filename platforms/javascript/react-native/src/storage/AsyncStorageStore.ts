import { ChangeArray, Profile, SelectedPersonalizationArray } from '@contentful/optimization-core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { z } from 'zod/mini'

export const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
export const CONSENT = '__ctfl_opt_consent__'
export const CHANGES_CACHE = '__ctfl_opt_changes__'
export const DEBUG_FLAG = '__ctfl_opt_debug__'
export const PROFILE_CACHE = '__ctfl_opt_profile__'
export const PERSONALIZATIONS_CACHE = '__ctfl_opt_personalizations__'

class AsyncStorageStore {
  private readonly cache = new Map<string, unknown>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const keys = [
        ANONYMOUS_ID,
        CONSENT,
        CHANGES_CACHE,
        DEBUG_FLAG,
        PROFILE_CACHE,
        PERSONALIZATIONS_CACHE,
      ]
      const values = await AsyncStorage.multiGet(keys)

      for (const [key, value] of values) {
        if (value) {
          try {
            this.cache.set(
              key,
              key === ANONYMOUS_ID || key === CONSENT || key === DEBUG_FLAG
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
      // eslint-disable-next-line no-console -- Logging initialization errors for debugging
      console.error('Failed to initialize AsyncStorageStore:', error)
    }
  }

  get anonymousId(): string | undefined {
    const value = this.cache.get(ANONYMOUS_ID)
    return typeof value === 'string' ? value : undefined
  }

  set anonymousId(id: string | undefined) {
    this.setCache(ANONYMOUS_ID, id)
  }

  get consent(): boolean | undefined {
    const value = this.cache.get(CONSENT)
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
    this.setCache(CONSENT, consent === undefined ? undefined : translated)
  }

  get debug(): boolean | undefined {
    const value = this.cache.get(DEBUG_FLAG)
    const debug = typeof value === 'string' ? value : undefined
    return debug ? debug === 'true' : undefined
  }

  set debug(debug: boolean | undefined) {
    this.setCache(DEBUG_FLAG, debug)
  }

  get changes(): ChangeArray | undefined {
    return this.getCache(CHANGES_CACHE, ChangeArray)
  }

  set changes(changes: ChangeArray | undefined) {
    this.setCache(CHANGES_CACHE, changes)
  }

  get profile(): Profile | undefined {
    return this.getCache(PROFILE_CACHE, Profile)
  }

  set profile(profile: Profile | undefined) {
    this.setCache(PROFILE_CACHE, profile)
  }

  get personalizations(): SelectedPersonalizationArray | undefined {
    return this.getCache(PERSONALIZATIONS_CACHE, SelectedPersonalizationArray)
  }

  set personalizations(personalizations: SelectedPersonalizationArray | undefined) {
    this.setCache(PERSONALIZATIONS_CACHE, personalizations)
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
        // eslint-disable-next-line no-console -- Logging storage errors for debugging
        console.error(`Failed to remove ${key} from AsyncStorage:`, error)
      })
    } else {
      const value = typeof data === 'string' ? data : JSON.stringify(data)
      this.cache.set(key, typeof data === 'string' ? data : data)
      AsyncStorage.setItem(key, value).catch((error: unknown) => {
        // eslint-disable-next-line no-console -- Logging storage errors for debugging
        console.error(`Failed to set ${key} in AsyncStorage:`, error)
      })
    }
  }
}

const store = new AsyncStorageStore()

export default store
