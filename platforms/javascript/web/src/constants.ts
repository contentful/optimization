// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

/**
 * Version of the Optimization Web SDK, replaced at build time.
 *
 * @defaultValue `'0.0.0'` when the build-time replacement is unavailable.
 *
 * @public
 */
export const OPTIMIZATION_WEB_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'

/**
 * Package name of the Optimization Web SDK, replaced at build time.
 *
 * @defaultValue `'@contentful/optimization-web'` when the build-time replacement is unavailable.
 *
 * @public
 */
export const OPTIMIZATION_WEB_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-web'

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
 * import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-web/constants'
 *
 * const anonId = Cookies.get(ANONYMOUS_ID_COOKIE)
 * ```
 */
export { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core/constants'

/**
 * Selector used to locate tracked entry elements in the DOM.
 *
 * @public
 */
export const ENTRY_SELECTOR = '[data-ctfl-entry-id]'

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
 * import { CAN_ADD_LISTENERS } from '@contentful/optimization-web/constants'
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

/**
 * Flag indicating whether the current environment supports `MutationObserver`
 * and can safely add DOM event listeners.
 *
 * @public
 */
export const HAS_MUTATION_OBSERVER = CAN_ADD_LISTENERS && typeof MutationObserver !== 'undefined'

/**
 * Flag indicating whether the current environment supports
 * `window.requestIdleCallback` and can safely add DOM event listeners.
 *
 * @public
 */
export const HAS_IDLE_CALLBACK =
  CAN_ADD_LISTENERS && typeof window.requestIdleCallback === 'function'

/**
 * Flag indicating whether the current environment supports
 * `window.cancelIdleCallback` and can safely add DOM event listeners.
 *
 * @public
 */
export const HAS_CANCEL_IDLE = CAN_ADD_LISTENERS && typeof window.cancelIdleCallback === 'function'
