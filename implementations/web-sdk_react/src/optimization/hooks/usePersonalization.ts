import type {
  MergeTagEntry,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useMemo } from 'react'
import { useOptimization } from './useOptimization'

export interface UsePersonalizationResult {
  resolveEntry: (
    baselineEntry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<EntrySkeletonType>
  getMergeTagValue: (mergeTagEntry: MergeTagEntry) => string
}

function fallbackResolveEntry(
  baselineEntry: Entry,
  _selectedPersonalizations?: SelectedPersonalizationArray,
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

export function usePersonalization(): UsePersonalizationResult {
  const { sdk, isReady } = useOptimization()

  return useMemo<UsePersonalizationResult>(() => {
    if (!isReady || sdk === undefined) {
      return {
        resolveEntry: fallbackResolveEntry,
        getMergeTagValue: (_mergeTagEntry: MergeTagEntry): string => '',
      }
    }

    return {
      resolveEntry: (
        baselineEntry: Entry,
        selectedPersonalizations?: SelectedPersonalizationArray,
      ): ResolvedData<EntrySkeletonType> =>
        sdk.resolveOptimizedEntry(baselineEntry, selectedPersonalizations),

      getMergeTagValue: (mergeTagEntry: MergeTagEntry): string =>
        toStringValue(sdk.getMergeTagValue(mergeTagEntry)),
    }
  }, [isReady, sdk])
}
