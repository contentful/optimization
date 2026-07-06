import { useMemo } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimization } from './useOptimization'

/**
 * Bound Optimization SDK actions safe to destructure in React components.
 *
 * @public
 */
export interface UseOptimizationActionsResult {
  readonly setConsent: OptimizationSdk['consent']
  readonly flushEvents: OptimizationSdk['flush']
  readonly identifyUser: OptimizationSdk['identify']
  readonly trackPageView: OptimizationSdk['page']
  readonly resetUser: OptimizationSdk['reset']
  readonly trackScreen: OptimizationSdk['screen']
  readonly trackEvent: OptimizationSdk['track']
}

/**
 * Returns bound Optimization SDK actions that are safe to destructure.
 *
 * @example
 * ```tsx
 * const { trackEvent, trackScreen, flushEvents, setConsent, resetUser } = useOptimizationActions()
 * await trackEvent({ event: 'purchase' })
 * await trackScreen({ name: 'Cart' })
 * await flushEvents()
 * setConsent(true)
 * resetUser()
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
      setConsent: (value) => {
        sdk.consent(value)
      },
      flushEvents: async () => {
        await sdk.flush()
      },
      identifyUser: async (payload) => await sdk.identify(payload),
      trackPageView: async (payload) => await sdk.page(payload),
      resetUser: () => {
        sdk.reset()
      },
      trackScreen: async (payload) => await sdk.screen(payload),
      trackEvent: async (payload) => await sdk.track(payload),
    }),
    [sdk],
  )
}
