import { createContext } from 'react'
import type { OptimizationSdk } from '../types'

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly isReady: boolean
  readonly error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
