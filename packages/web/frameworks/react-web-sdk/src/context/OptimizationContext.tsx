import type { Entry } from 'contentful'
import { createContext } from 'react'

import type { WebOptimizationRuntime } from '@contentful/optimization-web/runtime'

/**
 * Runtime visible to React presentation code.
 *
 * The value is either the browser's one live stateful SDK singleton or a read-only snapshot runtime
 * used for server and initial presentation. Snapshot values are not additional live SDK instances.
 */
export type OptimizationSdk = WebOptimizationRuntime

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly error: Error | undefined
  readonly isLive?: boolean
  readonly prefetchedManagedEntries?: ReadonlyMap<string, Entry>
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
