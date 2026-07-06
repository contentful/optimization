import type ContentfulOptimization from '@contentful/optimization-web'
import { useMemo } from 'react'
import { useOptimization } from './useOptimization'

type TrackViewPayload = Parameters<ContentfulOptimization['trackView']>[0]
type TrackViewResult = ReturnType<ContentfulOptimization['trackView']>

export interface UseAnalyticsResult {
  trackView: (payload: TrackViewPayload) => TrackViewResult | undefined
}

export function useAnalytics(): UseAnalyticsResult {
  const { sdk } = useOptimization()

  return useMemo<UseAnalyticsResult>(() => {
    if (sdk === undefined) {
      return {
        trackView: (_payload: TrackViewPayload): undefined => undefined,
      }
    }

    return {
      trackView: async (payload: TrackViewPayload): TrackViewResult => await sdk.trackView(payload),
    }
  }, [sdk])
}
