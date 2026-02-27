import type { AnalyticsEventInput } from '../types'

export interface UseAnalyticsResult {
  readonly track: (input: AnalyticsEventInput) => Promise<void>
  readonly identify: (id: string) => Promise<void>
  readonly reset: () => Promise<void>
}

export function useAnalytics(): UseAnalyticsResult {
  // Scaffold placeholder: analytics calls will proxy to the web SDK in follow-up work.
  return {
    track: async (_input: AnalyticsEventInput): Promise<void> => {},
    identify: async (_id: string): Promise<void> => {},
    reset: async (): Promise<void> => {},
  }
}
