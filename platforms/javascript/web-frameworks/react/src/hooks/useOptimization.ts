import type { Optimization } from '@contentful/optimization-web'
import { useContext } from 'react'
import OptimizationContext from '../context/OptimizationContext'

export function useOptimization(): Optimization {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Wrap your component tree with <OptimizationProvider config={...}>.',
    )
  }

  return context.instance.webInstance
}
