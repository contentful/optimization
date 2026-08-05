import type {
  MergeTagEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import { useMemo } from 'react'
import type { ContentEntrySkeleton, ContentfulEntry } from '../../types/contentful'
import { useOptimization } from './useOptimization'
import { useOptimizationState } from './useOptimizationState'

export interface UseOptimizationResolverResult {
  resolveEntry: (
    baselineEntry: ContentfulEntry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<ContentEntrySkeleton>
  getMergeTagValue: (mergeTagEntry: MergeTagEntry) => string
}

function fallbackResolveEntry(
  baselineEntry: ContentfulEntry,
  _selectedOptimizations?: SelectedOptimizationArray,
): ResolvedData<ContentEntrySkeleton> {
  return { entry: baselineEntry }
}

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return `${value}`
  }

  if (typeof value === 'symbol') {
    return value.description ?? value.toString()
  }

  return JSON.stringify(value)
}

export function useOptimizationResolver(): UseOptimizationResolverResult {
  const { sdk } = useOptimization()
  // Subscribe to selectedOptimizations so resolveEntry gets a new identity when the
  // Experience API responds. Without this, ContentEntry's useMemo would lock in the
  // baseline on first render (signal still empty) and never re-resolve on slow browsers.
  const { selectedOptimizations } = useOptimizationState(sdk?.states)

  return useMemo<UseOptimizationResolverResult>(() => {
    if (sdk === undefined) {
      return {
        resolveEntry: fallbackResolveEntry,
        getMergeTagValue: (_mergeTagEntry: MergeTagEntry): string => '',
      }
    }

    return {
      resolveEntry: (
        baselineEntry: ContentfulEntry,
        callerSelectedOptimizations?: SelectedOptimizationArray,
      ): ResolvedData<ContentEntrySkeleton> =>
        sdk.resolveOptimizedEntry(
          baselineEntry,
          callerSelectedOptimizations ?? selectedOptimizations,
        ),

      getMergeTagValue: (mergeTagEntry: MergeTagEntry): string =>
        toStringValue(sdk.getMergeTagValue(mergeTagEntry)),
    }
  }, [sdk, selectedOptimizations])
}
