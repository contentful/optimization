import { useContext } from 'react'
import { OptimizationContext, type OptimizationContextValue } from '../OptimizationProvider'

function assertContext(value: OptimizationContextValue | undefined): OptimizationContextValue {
  if (value === undefined) {
    throw new Error('useOptimization must be used within an OptimizationProvider')
  }

  return value
}

export function useOptimization(): OptimizationContextValue {
  const context = useContext(OptimizationContext)
  return assertContext(context)
}
