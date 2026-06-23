import { useMemo } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimization } from './useOptimization'

/**
 * Bound Optimization SDK actions safe to destructure in React components.
 *
 * @public
 */
export interface UseOptimizationActionsResult {
  readonly consent: OptimizationSdk['consent']
  readonly identify: OptimizationSdk['identify']
  readonly page: OptimizationSdk['page']
  readonly reset: OptimizationSdk['reset']
  readonly track: OptimizationSdk['track']
}

/**
 * Returns bound Optimization SDK actions that are safe to destructure.
 *
 * @example
 * ```tsx
 * const { track, consent, reset } = useOptimizationActions()
 * await track({ event: 'purchase' })
 * consent(true)
 * reset()
 * ```
 *
 * @remarks
 * This hook does not create a new SDK instance. It binds the most common
 * actions from the existing SDK instance returned by `useOptimization()`.
 *
 * @public
 */
export function useOptimizationActions(): UseOptimizationActionsResult {
  const sdk = useOptimization()

  return useMemo<UseOptimizationActionsResult>(
    () => ({
      consent: (value) => {
        sdk.consent(value)
      },
      identify: async (payload) => await sdk.identify(payload),
      page: async (payload) => await sdk.page(payload),
      reset: () => {
        sdk.reset()
      },
      track: async (payload) => await sdk.track(payload),
    }),
    [sdk],
  )
}
