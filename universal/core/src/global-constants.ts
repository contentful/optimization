// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

export const OPTIMIZATION_CORE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'
export const OPTIMIZATION_CORE_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-core'

/**
 * Anonymous-ID cookie name used by the Optimization Core.
 *
 * @public
 * @remarks
 * This constant represents the cookie key used by the Optimization Framework
 * to persist an anonymous identifier for tracking personalization and analytics
 * events when no explicit profile is known.
 *
 * @example
 * ```ts
 * import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
 * const profileId = request.cookies[ANONYMOUS_ID_COOKIE]
 * ```
 */
export const ANONYMOUS_ID_COOKIE = 'ctfl-opt-aid'

/**
 * Storage key for the anonymous identifier.
 *
 * @internal
 */
export const ANONYMOUS_ID_KEY = '__ctfl_opt_anonymous_id__'

/**
 * Storage key for the persisted consent status.
 *
 * @internal
 */
export const CONSENT_KEY = '__ctfl_opt_consent__'

/**
 * Storage key for cached Custom Flags.
 *
 * @internal
 */
export const CHANGES_CACHE_KEY = '__ctfl_opt_changes__'

/**
 * Storage key for the debug flag toggle.
 *
 * @internal
 */
export const DEBUG_FLAG_KEY = '__ctfl_opt_debug__'

/**
 * Storage key for cached profile data.
 *
 * @internal
 */
export const PROFILE_CACHE_KEY = '__ctfl_opt_profile__'

/**
 * Storage key for cached selected personalizations.
 *
 * @internal
 */
export const PERSONALIZATIONS_CACHE_KEY = '__ctfl_opt_personalizations__'

/**
 * Legacy anoynmous ID cookie key for migration from experience.js
 *
 * @internal
 */
export const ANONYMOUS_ID_COOKIE_LEGACY = 'ntaid'

/**
 * Legacy anoynmous ID storage key for migration from experience.js
 *
 * @internal
 */
export const ANONYMOUS_ID_KEY_LEGACY = '__nt_anonymous_id__'
