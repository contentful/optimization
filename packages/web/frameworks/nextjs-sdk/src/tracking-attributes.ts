import {
  resolveOptimizedEntryTrackingAttributes,
  type OptimizedEntryTrackingAttributeOptions,
  type OptimizedEntryTrackingAttributes,
} from '@contentful/optimization-react-web/tracking-attributes'

type ResolveTrackingAttributeArgs = Parameters<typeof resolveOptimizedEntryTrackingAttributes>

export type ServerTrackingBaselineEntry = ResolveTrackingAttributeArgs[0]
export type ServerTrackingResolvedData = ResolveTrackingAttributeArgs[1]
export type ServerTrackingAttributeOptions = OptimizedEntryTrackingAttributeOptions
export type ServerTrackingAttributes = OptimizedEntryTrackingAttributes

/**
 * Resolve the `data-ctfl-*` attributes needed by browser entry-interaction tracking.
 *
 * @remarks
 * Pass the baseline entry and the result of `@contentful/optimization-node`
 * `resolveOptimizedEntry()`. This keeps SSR markup aligned with the Web and
 * React SDK tracking contract without duplicating the attribute mapping.
 */
export function getServerTrackingAttributes(
  baselineEntry: ServerTrackingBaselineEntry,
  resolvedData: ServerTrackingResolvedData,
  options: ServerTrackingAttributeOptions = {},
): ServerTrackingAttributes {
  return resolveOptimizedEntryTrackingAttributes(baselineEntry, resolvedData, options)
}
