import type { Entry } from 'contentful'
import { createContext } from 'react'

import type { WebOptimizationRuntime } from '@contentful/optimization-web/runtime'

export type OptimizationSdk = WebOptimizationRuntime

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly error: Error | undefined
  readonly isLive?: boolean
  readonly serverOptimizedEntries?: ReadonlyMap<string, Entry>
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
