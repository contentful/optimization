// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined

export const OPTIMIZATION_WEB_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'

/**
 * Name of the cookie used by the Optimization Core to persist an anonymous ID.
 *
 * @public
 * @remarks
 * Re-exported here to provide a stable Web SDK import path. The value itself
 * is defined and maintained in `@contentful/optimization-core`.
 *
 * @example
 * ```ts
 * import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-web/global-constants'
 *
 * const anonId = Cookies.get(ANONYMOUS_ID_COOKIE)
 * ```
 */
export { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'

/**
 * Flag indicating whether the current environment can safely add DOM
 * event listeners.
 *
 * @public
 * @remarks
 * Many Web SDK utilities short-circuit to no-ops when this flag is `false`
 * (e.g., during server-side rendering).
 *
 * @example
 * ```ts
 * import { CAN_ADD_LISTENERS } from '@contentful/optimization-web/global-constants'
 *
 * if (CAN_ADD_LISTENERS) {
 *   window.addEventListener('resize', onResize)
 * }
 * ```
 */
export const CAN_ADD_LISTENERS =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof document.addEventListener === 'function'
