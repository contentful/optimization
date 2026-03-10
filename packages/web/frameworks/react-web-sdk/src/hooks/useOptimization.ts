import { useContext } from 'react'

import type ContentfulOptimization from '@contentful/optimization-web'
import { OptimizationContext } from '../context/OptimizationContext'

export function useOptimization(): ContentfulOptimization {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
    )
  }

  return context.instance
}
