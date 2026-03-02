import { createContext } from 'react'

import type { OptimizationWebSdk } from '../types'

export interface OptimizationContextValue {
  readonly instance: OptimizationWebSdk
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
