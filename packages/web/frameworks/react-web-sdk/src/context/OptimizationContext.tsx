import type ContentfulOptimization from '@contentful/optimization-web'
import { createContext } from 'react'

export type OptimizationSdk = ContentfulOptimization

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly isReady: boolean
  readonly error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
