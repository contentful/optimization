import { useEffect, useState } from 'react'
import type { OptimizationSdk } from '../OptimizationSdk'

/**
 * Subscribe to Core consent so first-party automatic tracking can re-check
 * allowlist-aware `hasConsent()` decisions when consent changes.
 *
 * @internal
 */
export function useOptimizationConsentState(
  contentfulOptimization: OptimizationSdk,
): boolean | undefined {
  const [consent, setConsent] = useState(contentfulOptimization.states.consent.current)

  useEffect(() => {
    const subscription = contentfulOptimization.states.consent.subscribe((value) => {
      setConsent(value)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [contentfulOptimization])

  return consent
}
