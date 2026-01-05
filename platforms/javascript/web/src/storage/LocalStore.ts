import { ChangeArray, Profile, SelectedPersonalizationArray } from '@contentful/optimization-core'
import type { z } from 'zod/mini'

/**
 * LocalStorage key for the anonymous identifier used by the Web SDK.
 *
 * @internal
 */
export const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

/**
 * LocalStorage key for the persisted consent status.
 *
 * @internal
 */
export const CONSENT = '__ctfl_opt_consent__'

/**
 * LocalStorage key for cached Custom Flags.
 *
 * @internal
 */
export const CHANGES_CACHE = '__ctfl_opt_changes__'

/**
 * LocalStorage key for the debug flag toggle.
 *
 * @internal
 */
export const DEBUG_FLAG = '__ctfl_opt_debug__'

/**
 * LocalStorage key for cached profile data.
 *
 * @internal
 */
export const PROFILE_CACHE = '__ctfl_opt_profile__'

/**
 * LocalStorage key for cached selected personalizations.
 *
 * @internal
 */
export const PERSONALIZATIONS_CACHE = '__ctfl_opt_personalizations__'

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
    if (options.resetConsent) localStorage.removeItem(CONSENT)
    if (options.resetDebug) localStorage.removeItem(DEBUG_FLAG)

    localStorage.removeItem(ANONYMOUS_ID)
    localStorage.removeItem(CHANGES_CACHE)
    localStorage.removeItem(PROFILE_CACHE)
    localStorage.removeItem(PERSONALIZATIONS_CACHE)
  },

  /**
   * Anonymous identifier currently stored in localStorage, if any.
   */
  get anonymousId(): string | undefined {
    return localStorage.getItem(ANONYMOUS_ID) ?? undefined
  },

  /**
   * Set or clear the anonymous identifier.
   *
   * @param id - The new identifier, or `undefined` to clear it.
   */
  set anonymousId(id: string | undefined) {
    LocalStore.setCache(ANONYMOUS_ID, id)
  },

  /**
   * Persisted consent status.
   *
   * @returns `true` if consent was stored as `accepted`, `false` if stored as
   * `denied`, or `undefined` when no value is stored.
   */
  get consent(): boolean | undefined {
    const consent = localStorage.getItem(CONSENT)

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

    LocalStore.setCache(CONSENT, consent === undefined ? undefined : translated)
  },

  /**
   * Persisted debug flag value.
   *
   * @returns `true` or `false` when stored, or `undefined` otherwise.
   */
  get debug(): boolean | undefined {
    const debug = localStorage.getItem(DEBUG_FLAG)

    return debug ? debug === 'true' : undefined
  },

  /**
   * Set or clear the debug flag value.
   *
   * @param debug - New flag value or `undefined` to remove.
   */
  set debug(debug: boolean | undefined) {
    LocalStore.setCache(DEBUG_FLAG, debug)
  },

  /**
   * Cached Custom Flags change array, if present.
   */
  get changes(): ChangeArray | undefined {
    return LocalStore.getCache(CHANGES_CACHE, ChangeArray)
  },

  /**
   * Cache a new change array or clear it.
   *
   * @param changes - New changes to store, or `undefined` to remove.
   */
  set changes(changes: ChangeArray | undefined) {
    LocalStore.setCache(CHANGES_CACHE, changes)
  },

  /**
   * Cached profile from the personalization service, if present.
   */
  get profile(): Profile | undefined {
    return LocalStore.getCache(PROFILE_CACHE, Profile)
  },

  /**
   * Cache a new profile or clear it.
   *
   * @param profile - New profile to store, or `undefined` to remove.
   */
  set profile(profile: Profile | undefined) {
    LocalStore.setCache(PROFILE_CACHE, profile)
  },

  /**
   * Cached selected personalizations, if present.
   */
  get personalizations(): SelectedPersonalizationArray | undefined {
    return LocalStore.getCache(PERSONALIZATIONS_CACHE, SelectedPersonalizationArray)
  },

  /**
   * Cache new selected personalizations or clear them.
   *
   * @param personalizations - New selections to store, or `undefined` to remove.
   */
  set personalizations(personalizations: SelectedPersonalizationArray | undefined) {
    LocalStore.setCache(PERSONALIZATIONS_CACHE, personalizations)
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
