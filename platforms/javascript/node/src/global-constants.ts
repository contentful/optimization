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
