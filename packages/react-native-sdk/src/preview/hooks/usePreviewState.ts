import type { Profile, SelectedOptimization } from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { useEffect, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import type { PreviewState } from '../types'

const logger = createScopedLogger('RN:Preview')

/**
 * Subscribes to SDK signals and provides the current preview state.
 *
 * @returns The current profile, selected optimizations, consent, and loading state
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @internal
 */
export function usePreviewState(): PreviewState {
  const contentfulOptimization = useOptimization()

  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [selectedOptimizations, setSelectedOptimizations] = useState<
    SelectedOptimization[] | undefined
  >(undefined)
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Subscribe to profile changes
  useEffect(() => {
    logger.debug('Subscribing to profile state')

    const subscription = contentfulOptimization.states.profile.subscribe((p) => {
      logger.debug('Profile updated:', p?.id)
      setProfile(p)
      setIsLoading(false)
    })

    return () => {
      logger.debug('Unsubscribing from profile state')
      subscription.unsubscribe()
    }
  }, [contentfulOptimization])

  // Subscribe to selected optimization changes
  useEffect(() => {
    logger.debug('Subscribing to selected optimizations state')

    const subscription = contentfulOptimization.states.selectedOptimizations.subscribe((p) => {
      logger.debug('Selected optimizations updated:', p?.length ?? 0, 'items')
      setSelectedOptimizations(p)
    })

    return () => {
      logger.debug('Unsubscribing from selected optimizations state')
      subscription.unsubscribe()
    }
  }, [contentfulOptimization])

  // Subscribe to consent changes
  useEffect(() => {
    logger.debug('Subscribing to consent state')

    const subscription = contentfulOptimization.states.consent.subscribe((c) => {
      logger.debug('Consent updated:', c)
      setConsent(c)
    })

    return () => {
      logger.debug('Unsubscribing from consent state')
      subscription.unsubscribe()
    }
  }, [contentfulOptimization])

  return {
    profile,
    selectedOptimizations,
    consent,
    isLoading,
  }
}

export default usePreviewState
