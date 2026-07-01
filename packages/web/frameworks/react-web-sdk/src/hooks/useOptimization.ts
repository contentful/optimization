import { useContext } from 'react'

import {
  OptimizationContext,
  type OptimizationContextValue,
  type OptimizationSdk,
} from '../context/OptimizationContext'

function getMissingProviderError(): Error {
  return new Error(
    'useOptimization must be used within an OptimizationProvider. ' +
      'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
  )
}

export function useOptimizationContext(): OptimizationContextValue {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw getMissingProviderError()
  }

  return context
}

/**
 * Returns the initialized Contentful Optimization SDK instance, or `undefined`
 * before the SDK is ready (during SSR and the first client render).
 *
 * @public
 */
export function useOptimization(): OptimizationSdk | undefined {
  const { sdk, isReady, error } = useOptimizationContext()

  if (!sdk || !isReady) {
    if (error) {
      throw new Error(`ContentfulOptimization SDK failed to initialize: ${error.message}`, {
        cause: error,
      })
    }

    return undefined
  }

  return sdk
}
