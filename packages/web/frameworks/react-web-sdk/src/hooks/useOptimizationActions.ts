import { useMemo } from 'react'

import type { EventEmissionResult } from '@contentful/optimization-web/core-sdk'
import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimization } from './useOptimization'

/**
 * Bound Optimization SDK actions safe to destructure in React components.
 *
 * @public
 */
export interface UseOptimizationActionsResult {
  readonly consent: OptimizationSdk['consent']
  readonly flush: () => Promise<void>
  readonly identify: (
    ...args: Parameters<OptimizationSdk['identify']>
  ) => Promise<EventEmissionResult | undefined>
  readonly page: (
    ...args: Parameters<OptimizationSdk['page']>
  ) => Promise<EventEmissionResult | undefined>
  readonly reset: OptimizationSdk['reset']
  readonly screen: (
    ...args: Parameters<OptimizationSdk['screen']>
  ) => Promise<EventEmissionResult | undefined>
  readonly track: (
    ...args: Parameters<OptimizationSdk['track']>
  ) => Promise<EventEmissionResult | undefined>
}

/**
 * Returns bound Optimization SDK actions that are safe to destructure.
 *
 * @example
 * ```tsx
 * const { track, screen, flush, consent, reset } = useOptimizationActions()
 * await track({ event: 'purchase' })
 * await screen({ name: 'Cart' })
 * await flush()
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
        if (sdk) sdk.consent(value)
      },
      flush: async () => {
        if (sdk) await sdk.flush()
      },
      identify: async (payload) => (sdk ? await sdk.identify(payload) : undefined),
      page: async (payload) => (sdk ? await sdk.page(payload) : undefined),
      reset: () => {
        if (sdk) sdk.reset()
      },
      screen: async (payload) => (sdk ? await sdk.screen(payload) : undefined),
      track: async (payload) => (sdk ? await sdk.track(payload) : undefined),
    }),
    [sdk],
  )
}
