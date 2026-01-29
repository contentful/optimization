import { logger, type Profile, type SelectedPersonalization } from '@contentful/optimization-core'
import { useEffect, useState } from 'react'
import { useOptimization } from '../../context/OptimizationContext'
import type { PreviewState } from '../types'

const LOG_LOCATION = 'RN:Preview'

/**
 * Hook that subscribes to SDK signals and provides the current preview state.
 * Uses the Optimization SDK's observable pattern to react to state changes.
 */
export function usePreviewState(): PreviewState {
  const optimization = useOptimization()

  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [personalizations, setPersonalizations] = useState<SelectedPersonalization[] | undefined>(
    undefined,
  )
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Subscribe to profile changes
  useEffect(() => {
    logger.debug(LOG_LOCATION, 'Subscribing to profile state')

    const subscription = optimization.states.profile.subscribe((p) => {
      logger.debug(LOG_LOCATION, 'Profile updated:', p?.id)
      setProfile(p)
      setIsLoading(false)
    })

    return () => {
      logger.debug(LOG_LOCATION, 'Unsubscribing from profile state')
      subscription.unsubscribe()
    }
  }, [optimization])

  // Subscribe to personalizations changes
  useEffect(() => {
    logger.debug(LOG_LOCATION, 'Subscribing to personalizations state')

    const subscription = optimization.states.personalizations.subscribe((p) => {
      logger.debug(LOG_LOCATION, 'Personalizations updated:', p?.length ?? 0, 'items')
      setPersonalizations(p)
    })

    return () => {
      logger.debug(LOG_LOCATION, 'Unsubscribing from personalizations state')
      subscription.unsubscribe()
    }
  }, [optimization])

  // Subscribe to consent changes
  useEffect(() => {
    logger.debug(LOG_LOCATION, 'Subscribing to consent state')

    const subscription = optimization.states.consent.subscribe((c) => {
      logger.debug(LOG_LOCATION, 'Consent updated:', c)
      setConsent(c)
    })

    return () => {
      logger.debug(LOG_LOCATION, 'Unsubscribing from consent state')
      subscription.unsubscribe()
    }
  }, [optimization])

  return {
    profile,
    personalizations,
    consent,
    isLoading,
  }
}

export default usePreviewState
