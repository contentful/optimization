// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

/**
 * The current version of the Optimization Node SDK, injected at build-time.
 *
 * @defaultValue `'0.0.0'` when the build-time replacement is unavailable.
 *
 * @public
 */
export const OPTIMIZATION_NODE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'

/**
 * The package name of the Optimization Node SDK, injected at build-time.
 *
 * @defaultValue `'@contentful/optimization-node'` when the build-time replacement is unavailable.
 *
 * @public
 */
export const OPTIMIZATION_NODE_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-node'

/**
 * Re-exports of anonymous identifier constants used by the Optimization Core.
 *
 * @remarks
 * This constant is surfaced here to provide a stable import path for Node SDK
 * consumers. It represents the cookie key used by the Optimization Framework
 * to persist an anonymous identifier for tracking optimization and insights
 * events when no explicit profile is known.
 *
 * @example
 * ```ts
 * import { ANONYMOUS_ID_COOKIE, ANONYMOUS_ID_KEY } from '@contentful/optimization-node/constants'
 * const cookieId = request.cookies[ANONYMOUS_ID_COOKIE]
 * const storageId = localStorage.getItem(ANONYMOUS_ID_KEY)
 * ```
 *
 * @see {@link ANONYMOUS_ID_COOKIE} and {@link ANONYMOUS_ID_KEY} in
 * `@contentful/optimization-core` for the
 * authoritative definition and documentation.
 *
 * @public
 */
export { ANONYMOUS_ID_COOKIE, ANONYMOUS_ID_KEY } from '@contentful/optimization-core/constants'
