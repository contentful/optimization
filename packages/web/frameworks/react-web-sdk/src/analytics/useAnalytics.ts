import type ContentfulOptimization from '@contentful/optimization-web'
import { useMemo } from 'react'
import { useOptimization } from '../hooks/useOptimization'

export interface UseAnalyticsResult {
  readonly trackView: (
    payload: Parameters<ContentfulOptimization['trackView']>[0],
  ) => ReturnType<ContentfulOptimization['trackView']> | undefined
}

export function useAnalytics(): UseAnalyticsResult {
  const { sdk, isReady } = useOptimization()

  return useMemo<UseAnalyticsResult>(() => {
    if (!isReady || sdk === undefined) {
      return {
        trackView: () => undefined,
      }
    }

    return {
      trackView: async (payload) => await sdk.trackView(payload),
    }
  }, [isReady, sdk])
}
