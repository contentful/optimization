import { useMemo } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimizationContext } from './useOptimization'

/**
 * Bound Optimization SDK actions safe to destructure in React components.
 *
 * @public
 */
export interface UseOptimizationActionsResult {
  readonly consent: OptimizationSdk['consent']
  readonly flush: OptimizationSdk['flush']
  readonly identify: OptimizationSdk['identify']
  readonly page: OptimizationSdk['page']
  readonly reset: OptimizationSdk['reset']
  readonly screen: OptimizationSdk['screen']
  readonly track: OptimizationSdk['track']
}

/**
 * Returns bound Optimization SDK actions that are safe to destructure.
 *
 * @remarks
 * SSR-safe: when the SDK is not yet ready (server render or initial
 * synchronous client render) the returned actions no-op and event-emitting
 * actions resolve to `{ accepted: false }`. Once the SDK is ready subsequent
 * calls invoke the real methods.
 *
 * @example
 * ```tsx
 * const { track, screen, flush, consent, reset } = useOptimizationActions()
 * await track({ event: 'purchase' })
 * ```
 *
 * @public
 */
export function useOptimizationActions(): UseOptimizationActionsResult {
  const { sdk } = useOptimizationContext()

  return useMemo<UseOptimizationActionsResult>(
    () => ({
      consent: (value) => {
        sdk?.consent(value)
      },
      flush: async () => {
        await sdk?.flush()
      },
      identify: async (payload) => (await sdk?.identify(payload)) ?? { accepted: false },
      page: async (payload) => (await sdk?.page(payload)) ?? { accepted: false },
      reset: () => {
        sdk?.reset()
      },
      screen: async (payload) => (await sdk?.screen(payload)) ?? { accepted: false },
      track: async (payload) => (await sdk?.track(payload)) ?? { accepted: false },
    }),
    [sdk],
  )
}
