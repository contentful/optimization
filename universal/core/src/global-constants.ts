// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined

export const OPTIMIZATION_CORE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'

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
