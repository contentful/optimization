import { useContext, useMemo } from 'react'

import { OptimizationContext, type OptimizationContextValue } from '../context/OptimizationContext'
import type { AnalyticsEventInput, OptimizationSdk, PersonalizationEntryInput } from '../types'

export interface UseOptimizationResult extends OptimizationContextValue {
  readonly trackView: (
    payload: AnalyticsEventInput,
  ) => ReturnType<OptimizationSdk['trackView']> | undefined
  readonly resolveEntry: (entry: PersonalizationEntryInput) => PersonalizationEntryInput
}

export function useOptimization(): UseOptimizationResult {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
    )
  }

  const { sdk, isReady } = context

  return useMemo<UseOptimizationResult>(
    () => ({
      ...context,
      trackView: async (payload) => {
        if (!sdk || !isReady) {
          return undefined
        }

        return await sdk.trackView(payload)
      },
      resolveEntry: (entry) => {
        if (!sdk || !isReady) {
          return entry
        }

        return sdk.personalizeEntry(entry, sdk.states.selectedPersonalizations.current).entry
      },
    }),
    [context, isReady, sdk],
  )
}
