import type { EntryFor, ResolvedData } from '@contentful/optimization-core'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'

/**
 * Value type supported by optimized-entry host tracking attributes.
 *
 * @public
 */
export type OptimizedEntryHostAttributeValue = string | boolean | number | undefined

/**
 * Options that control optimized-entry interaction tracking attributes.
 *
 * @public
 */
export interface OptimizedEntryTrackingAttributeOptions {
  /** Whether the host element should be treated as a click target. */
  readonly clickable?: boolean
  /** Per-entry click tracking override. */
  readonly trackClicks?: boolean
  /** Per-entry hover tracking override. */
  readonly trackHovers?: boolean
  /** Per-entry view tracking override. */
  readonly trackViews?: boolean
}

/**
 * Data attributes applied to optimized-entry host elements for automatic tracking.
 *
 * @public
 */
export type OptimizedEntryTrackingAttributes = Record<string, OptimizedEntryHostAttributeValue>

interface SelectedOptimizationWithDuplicationScope {
  readonly duplicationScope?: unknown
  readonly experienceId?: string
  readonly sticky?: boolean
  readonly variantIndex?: number
}

function resolveDuplicationScope(
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization'],
): string | undefined {
  const candidate = (selectedOptimization as SelectedOptimizationWithDuplicationScope | undefined)
    ?.duplicationScope

  if (typeof candidate !== 'string') {
    return undefined
  }

  return candidate.trim() ? candidate : undefined
}

/**
 * Build host tracking attributes for an optimized-entry presentation snapshot.
 *
 * @public
 */
export function resolveOptimizedEntryTrackingAttributes<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  baselineEntry: EntryFor<S, M, L>,
  resolvedData: ResolvedData<S, M, L>,
  options: OptimizedEntryTrackingAttributeOptions = {},
): OptimizedEntryTrackingAttributes {
  const {
    selectedOptimization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData
  const { clickable, trackClicks, trackHovers, trackViews } = options

  return {
    'data-ctfl-baseline-id': baselineEntry.sys.id,
    'data-ctfl-clickable': clickable === true ? true : undefined,
    'data-ctfl-duplication-scope': resolveDuplicationScope(selectedOptimization),
    'data-ctfl-empty-variant': resolvedData.isEmptyVariant === true ? true : undefined,
    'data-ctfl-entry-id': entryId,
    'data-ctfl-optimization-id': selectedOptimization?.experienceId,
    'data-ctfl-optimization-context-id': resolvedData.optimizationContextId,
    'data-ctfl-sticky': selectedOptimization?.sticky,
    'data-ctfl-track-clicks': trackClicks,
    'data-ctfl-track-hovers': trackHovers,
    'data-ctfl-track-views': trackViews,
    'data-ctfl-variant-index': selectedOptimization?.variantIndex ?? 0,
  }
}
