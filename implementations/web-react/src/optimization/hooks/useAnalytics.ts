import type Optimization from '@contentful/optimization-web'
import { useMemo } from 'react'
import { useOptimization } from './useOptimization'

type TrackComponentViewPayload = Parameters<Optimization['trackComponentView']>[0]
type TrackComponentViewResult = ReturnType<Optimization['trackComponentView']>

export interface UseAnalyticsResult {
  trackView: (payload: TrackComponentViewPayload) => TrackComponentViewResult | undefined
}

export function useAnalytics(): UseAnalyticsResult {
  const { sdk, isReady } = useOptimization()

  return useMemo<UseAnalyticsResult>(() => {
    if (!isReady || sdk === undefined) {
      return {
        trackView: (_payload: TrackComponentViewPayload): undefined => undefined,
      }
    }

    return {
      trackView: async (payload: TrackComponentViewPayload): TrackComponentViewResult =>
        await sdk.trackComponentView(payload),
    }
  }, [isReady, sdk])
}
