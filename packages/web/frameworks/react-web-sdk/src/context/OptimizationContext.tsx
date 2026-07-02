import { createContext } from 'react'

import type { WebOptimizationRuntime } from '../runtime/webRuntime'

/**
 * The runtime object exposed to React consumers.
 *
 * @remarks
 * On the client after hydration this is the live `ContentfulOptimization`
 * instance; during server rendering and the initial client render it is a
 * read-only snapshot runtime with the same shape. Both satisfy
 * {@link WebOptimizationRuntime}, so consumers never branch on environment.
 *
 * @public
 */
export type OptimizationSdk = WebOptimizationRuntime

export interface OptimizationContextValue {
  /**
   * The isomorphic Optimization runtime. Always present once a provider is
   * mounted: a snapshot-backed runtime on the server and initial client render,
   * the live SDK after hydration. Consumers use the same object in every
   * environment.
   */
  readonly sdk: OptimizationSdk | undefined
  readonly isReady: boolean
  readonly error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)
