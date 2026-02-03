import {
  ANONYMOUS_ID_KEY,
  ANONYMOUS_ID_KEY_LEGACY,
  ChangeArray,
  CHANGES_CACHE_KEY,
  CONSENT_KEY,
  DEBUG_FLAG_KEY,
  PERSONALIZATIONS_CACHE_KEY,
  Profile,
  PROFILE_CACHE_KEY,
  SelectedPersonalizationArray,
} from '@contentful/optimization-core'
import type { z } from 'zod/mini'

/**
 * Local storage abstraction used by the Web SDK to persist optimization state.
 *
 * @internal
 * @remarks
 * Wraps browser `localStorage` access and uses zod parsers to safely read and
 * write typed values. All getters return `undefined` when no valid data is
 * present.
 */
const LocalStore = {
  /**
   * Reset local caches used by the Web SDK.
   *
   * @param options - Optional flags controlling whether consent and debug keys
   *   should also be removed.
   * @example
   * ```ts
   * LocalStore.reset({ resetConsent: true, resetDebug: true })
   * ```
   */
  reset(options = { resetConsent: false, resetDebug: false }) {
    if (options.resetConsent) localStorage.removeItem(CONSENT_KEY)
    if (options.resetDebug) localStorage.removeItem(DEBUG_FLAG_KEY)

    localStorage.removeItem(ANONYMOUS_ID_KEY)
    localStorage.removeItem(CHANGES_CACHE_KEY)
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(PERSONALIZATIONS_CACHE_KEY)
  },

  /**
   * Anonymous identifier currently stored in localStorage, if any.
   */
  get anonymousId(): string | undefined {
    const legacyAnonymousIdValue = localStorage.getItem(ANONYMOUS_ID_KEY_LEGACY)

    if (legacyAnonymousIdValue) localStorage.removeItem(ANONYMOUS_ID_KEY_LEGACY)

    return legacyAnonymousIdValue ?? localStorage.getItem(ANONYMOUS_ID_KEY) ?? undefined
  },

  /**
   * Set or clear the anonymous identifier.
   *
   * @param id - The new identifier, or `undefined` to clear it.
   */
  set anonymousId(id: string | undefined) {
    LocalStore.setCache(ANONYMOUS_ID_KEY, id)
  },

  /**
   * Persisted consent status.
   *
   * @returns `true` if consent was stored as `accepted`, `false` if stored as
   * `denied`, or `undefined` when no value is stored.
   */
  get consent(): boolean | undefined {
    const consent = localStorage.getItem(CONSENT_KEY)

    switch (consent) {
      case 'accepted':
        return true
      case 'denied':
        return false
      default:
    }
  },

  /**
   * Set or clear the persisted consent status.
   *
   * @param consent - `true` for accepted, `false` for denied, or `undefined`
   * to remove the stored value.
   */
  set consent(consent: boolean | undefined) {
    const translated = consent ? 'accepted' : 'denied'

    LocalStore.setCache(CONSENT_KEY, consent === undefined ? undefined : translated)
  },

  /**
   * Persisted debug flag value.
   *
   * @returns `true` or `false` when stored, or `undefined` otherwise.
   */
  get debug(): boolean | undefined {
    const debug = localStorage.getItem(DEBUG_FLAG_KEY)

    return debug ? debug === 'true' : undefined
  },

  /**
   * Set or clear the debug flag value.
   *
   * @param debug - New flag value or `undefined` to remove.
   */
  set debug(debug: boolean | undefined) {
    LocalStore.setCache(DEBUG_FLAG_KEY, debug)
  },

  /**
   * Cached Custom Flags change array, if present.
   */
  get changes(): ChangeArray | undefined {
    return LocalStore.getCache(CHANGES_CACHE_KEY, ChangeArray)
  },

  /**
   * Cache a new change array or clear it.
   *
   * @param changes - New changes to store, or `undefined` to remove.
   */
  set changes(changes: ChangeArray | undefined) {
    LocalStore.setCache(CHANGES_CACHE_KEY, changes)
  },

  /**
   * Cached profile from the personalization service, if present.
   */
  get profile(): Profile | undefined {
    return LocalStore.getCache(PROFILE_CACHE_KEY, Profile)
  },

  /**
   * Cache a new profile or clear it.
   *
   * @param profile - New profile to store, or `undefined` to remove.
   */
  set profile(profile: Profile | undefined) {
    LocalStore.setCache(PROFILE_CACHE_KEY, profile)
  },

  /**
   * Cached selected personalizations, if present.
   */
  get personalizations(): SelectedPersonalizationArray | undefined {
    return LocalStore.getCache(PERSONALIZATIONS_CACHE_KEY, SelectedPersonalizationArray)
  },

  /**
   * Cache new selected personalizations or clear them.
   *
   * @param personalizations - New selections to store, or `undefined` to remove.
   */
  set personalizations(personalizations: SelectedPersonalizationArray | undefined) {
    LocalStore.setCache(PERSONALIZATIONS_CACHE_KEY, personalizations)
  },

  /**
   * Safely read and parse typed data from localStorage.
   *
   * @typeParam T - Zod mini type describing the stored shape.
   * @param key - LocalStorage key to read from.
   * @param parser - Zod parser used to validate and parse the stored JSON.
   * @returns Parsed data when present and valid, otherwise `undefined`.
   */
  getCache<T extends z.ZodMiniType>(key: string, parser: T): z.output<T> | undefined {
    const cacheString = localStorage.getItem(key)

    if (!cacheString) return

    const parsedCache = parser.safeParse(JSON.parse(cacheString))

    if (parsedCache.success) return parsedCache.data
  },

  /**
   * Write arbitrary data to localStorage or remove the key when `undefined`.
   *
   * @param key - LocalStorage key to write to.
   * @param data - Value to store. Strings are written as-is; other values
   * are JSON-stringified.
   */
  setCache(key: string, data: unknown): void {
    if (data === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data))
    }
  },
}

export default LocalStore
