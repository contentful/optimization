import { createContext, useContext } from 'react'
import type Optimization from '../'

interface OptimizationContextValue {
  instance: Optimization
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null)

export function useOptimization(): Optimization {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationProvider instance={optimizationInstance}>.',
    )
  }

  return context.instance
}

export default OptimizationContext
