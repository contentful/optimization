import { createContext } from 'react'

import type { WebOptimizationRuntime } from '../runtime/webRuntime'

export type OptimizationSdk = WebOptimizationRuntime

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
