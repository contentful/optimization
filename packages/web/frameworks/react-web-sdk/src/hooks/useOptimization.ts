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
 * Returns the Contentful Optimization runtime.
 *
 * @remarks
 * The returned object is isomorphic and always present once a provider is
 * mounted: a read-only snapshot runtime during server rendering and the initial
 * client render, and the live SDK after hydration. It is safe to call in any
 * environment — reads and entry resolution work everywhere; event and
 * browser-only tracking calls are no-ops on the server. Throws only when used
 * outside an {@link OptimizationProvider}.
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

    throw getMissingProviderError()
  }

  return sdk
}
