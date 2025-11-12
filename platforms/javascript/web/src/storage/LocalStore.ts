import { ChangeArray, Profile, SelectedPersonalizationArray } from '@contentful/optimization-core'
import type { z } from 'zod/mini'

export const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
export const CONSENT = '__ctfl_opt_consent__'
export const CHANGES_CACHE = '__ctfl_opt_changes__'
export const DEBUG_FLAG = '__ctfl_opt_debug__'
export const PROFILE_CACHE = '__ctfl_opt_profile__'
export const PERSONALIZATIONS_CACHE = '__ctfl_opt_personalizations__'

const LocalStore = {
  reset(options = { resetConsent: false, resetDebug: false }) {
    if (options.resetConsent) localStorage.removeItem(CONSENT)
    if (options.resetDebug) localStorage.removeItem(DEBUG_FLAG)

    localStorage.removeItem(ANONYMOUS_ID)
    localStorage.removeItem(CHANGES_CACHE)
    localStorage.removeItem(PROFILE_CACHE)
    localStorage.removeItem(PERSONALIZATIONS_CACHE)
  },

  get anonymousId(): string | undefined {
    return localStorage.getItem(ANONYMOUS_ID) ?? undefined
  },

  set anonymousId(id: string | undefined) {
    LocalStore.setCache(ANONYMOUS_ID, id)
  },

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

  set consent(consent: boolean | undefined) {
    const translated = consent ? 'accepted' : 'denied'

    LocalStore.setCache(CONSENT, consent === undefined ? undefined : translated)
  },

  get debug(): boolean | undefined {
    const debug = localStorage.getItem(DEBUG_FLAG)

    return debug ? debug === 'true' : undefined
  },

  set debug(debug: boolean | undefined) {
    LocalStore.setCache(DEBUG_FLAG, debug)
  },

  get changes(): ChangeArray | undefined {
    return LocalStore.getCache(CHANGES_CACHE, ChangeArray)
  },

  set changes(changes: ChangeArray | undefined) {
    LocalStore.setCache(CHANGES_CACHE, changes)
  },

  get profile(): Profile | undefined {
    return LocalStore.getCache(PROFILE_CACHE, Profile)
  },

  set profile(profile: Profile | undefined) {
    LocalStore.setCache(PROFILE_CACHE, profile)
  },

  get personalizations(): SelectedPersonalizationArray | undefined {
    return LocalStore.getCache(PERSONALIZATIONS_CACHE, SelectedPersonalizationArray)
  },

  set personalizations(personalizations: SelectedPersonalizationArray | undefined) {
    LocalStore.setCache(PERSONALIZATIONS_CACHE, personalizations)
  },

  getCache<T extends z.ZodMiniType>(key: string, parser: T): z.output<T> | undefined {
    const cacheString = localStorage.getItem(key)

    if (!cacheString) return

    const parsedCache = parser.safeParse(JSON.parse(cacheString))

    if (parsedCache.success) return parsedCache.data
  },

  setCache(key: string, data: unknown): void {
    if (data === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data))
    }
  },
}

export default LocalStore
