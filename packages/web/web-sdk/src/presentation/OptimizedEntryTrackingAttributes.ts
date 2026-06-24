import type { ResolvedData } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'

export type OptimizedEntryHostAttributeValue = string | boolean | number | undefined

export interface OptimizedEntryTrackingAttributeOptions {
  readonly clickable?: boolean
  readonly hoverDurationUpdateIntervalMs?: number
  readonly trackClicks?: boolean
  readonly trackHovers?: boolean
  readonly trackViews?: boolean
  readonly viewDurationUpdateIntervalMs?: number
}

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
    'data-ctfl-entry-id': entryId,
    'data-ctfl-hover-duration-update-interval-ms': hoverDurationUpdateIntervalMs,
    'data-ctfl-optimization-id': selectedOptimization?.experienceId,
    'data-ctfl-sticky': selectedOptimization?.sticky,
    'data-ctfl-track-clicks': trackClicks,
    'data-ctfl-track-hovers': trackHovers,
    'data-ctfl-track-views': trackViews,
    'data-ctfl-variant-index': selectedOptimization?.variantIndex ?? 0,
    'data-ctfl-view-duration-update-interval-ms': viewDurationUpdateIntervalMs,
  }
}
