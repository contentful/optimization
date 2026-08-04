import type { EntryFor, ResolvedData } from '@contentful/optimization-react-web/core-sdk'
import {
  resolveOptimizedEntryTrackingAttributes,
  type OptimizedEntryTrackingAttributeOptions,
  type OptimizedEntryTrackingAttributes,
} from '@contentful/optimization-react-web/tracking-attributes'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'

export type ServerTrackingBaselineEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = EntryFor<S, M, L>
export type ServerTrackingResolvedData<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = ResolvedData<S, M, L>
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
export function getServerTrackingAttributes<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  baselineEntry: ServerTrackingBaselineEntry<S, M, L>,
  resolvedData: ServerTrackingResolvedData<S, M, L>,
  options: ServerTrackingAttributeOptions = {},
): ServerTrackingAttributes {
  return resolveOptimizedEntryTrackingAttributes(baselineEntry, resolvedData, options)
}
