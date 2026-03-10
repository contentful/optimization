import type ContentfulOptimization from '@contentful/optimization-web'
import { createContext } from 'react'

export interface OptimizationContextValue {
  readonly instance: ContentfulOptimization
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
