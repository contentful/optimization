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
 * Returns the initialized Contentful Optimization SDK instance.
 *
 * @public
 */
export function useOptimization(): OptimizationSdk {
  const { sdk, error } = useOptimizationContext()

  if (!sdk) {
    if (error) {
      throw new Error(`ContentfulOptimization SDK failed to initialize: ${error.message}`, {
        cause: error,
      })
    }

    throw new Error('ContentfulOptimization SDK is unavailable.')
  }

  return sdk
}
