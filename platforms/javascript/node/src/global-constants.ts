// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

export const OPTIMIZATION_NODE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'
export const OPTIMIZATION_NODE_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-node'

/**
 * Re-export of the anonymous-ID cookie name used by the Optimization Core.
 *
 * @public
 * @remarks
 * This constant is surfaced here to provide a stable import path for Node SDK
 * consumers. It represents the cookie key used by the Optimization Framework
 * to persist an anonymous identifier for tracking personalization and analytics
 * events when no explicit profile is known.
 *
 * @see {@link ANONYMOUS_ID_COOKIE} in `@contentful/optimization-core` for the
 * authoritative definition and documentation.
 *
 * @example
 * ```ts
 * import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node'
 * const id = request.cookies[ANONYMOUS_ID_COOKIE]
 * ```
 */
export { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
