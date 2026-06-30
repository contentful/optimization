import { useContext } from 'react'

import {
  OptimizationContext,
  type OptimizationContextValue,
  type OptimizationSdk,
} from '../context/OptimizationContext'
import { SSR_STUB } from './ssrStub'

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
  const { sdk, isReady, error } = useOptimizationContext()

  if (!sdk || !isReady) {
    if (error) {
      throw new Error(`ContentfulOptimization SDK failed to initialize: ${error.message}`, {
        cause: error,
      })
    }

    // The SDK initializes in useLayoutEffect. Before that fires (during SSR and on the first
    // client render), return a stub so components can render without throwing. All actual SDK
    // method calls happen in effects or event handlers, which run after useLayoutEffect has
    // already set the real SDK into context.
    return SSR_STUB
  }

  return sdk
}
