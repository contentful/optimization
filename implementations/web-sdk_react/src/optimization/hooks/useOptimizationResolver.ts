import type {
  MergeTagEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useMemo } from 'react'
import { useOptimization } from './useOptimization'
import { useOptimizationState } from './useOptimizationState'

export interface UseOptimizationResolverResult {
  resolveEntry: (
    baselineEntry: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<EntrySkeletonType>
  getMergeTagValue: (mergeTagEntry: MergeTagEntry) => string
}

function fallbackResolveEntry(
  baselineEntry: Entry,
  _selectedOptimizations?: SelectedOptimizationArray,
): ResolvedData<EntrySkeletonType> {
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
  const { sdk, isReady } = useOptimization()
  // Subscribe to selectedOptimizations so resolveEntry gets a new identity when the
  // Experience API responds. Without this, ContentEntry's useMemo would lock in the
  // baseline on first render (signal still empty) and never re-resolve on slow browsers.
  const { selectedOptimizations } = useOptimizationState(sdk?.states)

  return useMemo<UseOptimizationResolverResult>(() => {
    if (!isReady || sdk === undefined) {
      return {
        resolveEntry: fallbackResolveEntry,
        getMergeTagValue: (_mergeTagEntry: MergeTagEntry): string => '',
      }
    }

    return {
      resolveEntry: (
        baselineEntry: Entry,
        callerSelectedOptimizations?: SelectedOptimizationArray,
      ): ResolvedData<EntrySkeletonType> =>
        sdk.resolveOptimizedEntry(
          baselineEntry,
          callerSelectedOptimizations ?? selectedOptimizations,
        ),

      getMergeTagValue: (mergeTagEntry: MergeTagEntry): string =>
        toStringValue(sdk.getMergeTagValue(mergeTagEntry)),
    }
  }, [isReady, sdk, selectedOptimizations])
}
