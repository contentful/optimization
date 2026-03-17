import { useContext } from 'react'

import { OptimizationContext, type OptimizationContextValue } from '../context/OptimizationContext'

export function useOptimization(): OptimizationContextValue {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
    )
  }

  return context
}
