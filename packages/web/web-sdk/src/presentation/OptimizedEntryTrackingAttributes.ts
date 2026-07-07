import type { ResolvedData } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'

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
  /** Hover duration update interval in milliseconds. */
  readonly hoverDurationUpdateIntervalMs?: number
  /** Per-entry click tracking override. */
  readonly trackClicks?: boolean
  /** Per-entry hover tracking override. */
  readonly trackHovers?: boolean
  /** Per-entry view tracking override. */
  readonly trackViews?: boolean
  /** View duration update interval in milliseconds. */
  readonly viewDurationUpdateIntervalMs?: number
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
export function resolveOptimizedEntryTrackingAttributes(
  baselineEntry: Entry,
  resolvedData: ResolvedData<EntrySkeletonType>,
  options: OptimizedEntryTrackingAttributeOptions = {},
): OptimizedEntryTrackingAttributes {
  const {
    selectedOptimization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData
  const {
    clickable,
    hoverDurationUpdateIntervalMs,
    trackClicks,
    trackHovers,
    trackViews,
    viewDurationUpdateIntervalMs,
  } = options

  return {
    'data-ctfl-baseline-id': baselineEntry.sys.id,
    'data-ctfl-clickable': clickable === true ? true : undefined,
    'data-ctfl-duplication-scope': resolveDuplicationScope(selectedOptimization),
    'data-ctfl-empty-variant': resolvedData.isEmptyVariant === true ? true : undefined,
    'data-ctfl-entry-id': entryId,
    'data-ctfl-hover-duration-update-interval-ms': hoverDurationUpdateIntervalMs,
    'data-ctfl-optimization-id': selectedOptimization?.experienceId,
    'data-ctfl-optimization-context-id': resolvedData.optimizationContextId,
    'data-ctfl-sticky': selectedOptimization?.sticky,
    'data-ctfl-track-clicks': trackClicks,
    'data-ctfl-track-hovers': trackHovers,
    'data-ctfl-track-views': trackViews,
    'data-ctfl-variant-index': selectedOptimization?.variantIndex ?? 0,
    'data-ctfl-view-duration-update-interval-ms': viewDurationUpdateIntervalMs,
  }
}
