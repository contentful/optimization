import { useEffect, useState } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'

/**
 * Subscribe to Core consent so first-party automatic tracking can re-check
 * allowlist-aware `hasConsent()` decisions when consent changes.
 *
 * @internal
 */
export function useOptimizationConsentState(
  contentfulOptimization: ContentfulOptimization,
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
