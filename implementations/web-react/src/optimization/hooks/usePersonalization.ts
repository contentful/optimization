import type Optimization from '@contentful/optimization-web'
import { useMemo } from 'react'
import { useOptimization } from './useOptimization'

type PersonalizationApi = Optimization['personalization']
type BaselineEntry = Parameters<PersonalizationApi['personalizeEntry']>[0]
type PersonalizeResult = ReturnType<PersonalizationApi['personalizeEntry']>
type MergeTagTarget = Parameters<PersonalizationApi['getMergeTagValue']>[0]

export interface UsePersonalizationResult {
  resolveEntry: (baselineEntry: BaselineEntry) => PersonalizeResult
  getMergeTagValue: (mergeTagEntry: MergeTagTarget) => string
}

function fallbackResolveEntry(baselineEntry: BaselineEntry): PersonalizeResult {
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
        getMergeTagValue: (_mergeTagEntry: MergeTagTarget): string => '',
      }
    }

    return {
      resolveEntry: (baselineEntry: BaselineEntry): PersonalizeResult =>
        sdk.personalization.personalizeEntry(baselineEntry),

      getMergeTagValue: (mergeTagEntry: MergeTagTarget): string =>
        toStringValue(sdk.personalization.getMergeTagValue(mergeTagEntry)),
    }
  }, [isReady, sdk])
}
