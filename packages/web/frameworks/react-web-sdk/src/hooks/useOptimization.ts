import { useContext } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'
import type { OptimizationWebSdk } from '../types'

export function useOptimization(): OptimizationWebSdk {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
    )
  }

  return context.instance
}
