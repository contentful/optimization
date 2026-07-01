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

    // On the server the SDK is initialized synchronously in the useState initializer,
    // so this path is only reached during the browser's first-render window before
    // useLayoutEffect fires. The stub provides no-op defaults for that brief window.
    return SSR_STUB
  }

  return sdk
}
