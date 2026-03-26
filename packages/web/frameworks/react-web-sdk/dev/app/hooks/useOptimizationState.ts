import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-api-schemas'
import { useEffect, useState } from 'react'
import type { OptimizationSdk } from '../../../src/context/OptimizationContext'

const MAX_EVENT_LOG_ITEMS = 20

export interface UseOptimizationStateResult {
  consent: boolean | undefined
  profile: Profile | undefined
  selectedOptimizations: SelectedOptimizationArray | undefined
  previewPanelOpen: boolean
  eventLog: string[]
}

export function useOptimizationState(
  optimization: OptimizationSdk | undefined,
): UseOptimizationStateResult {
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [selectedOptimizations, setSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)
  const [eventLog, setEventLog] = useState<string[]>([])

  useEffect(() => {
    if (!optimization) return

    const consentSub = optimization.states.consent.subscribe((nextConsent) => {
      setConsent(nextConsent)
    })
    const profileSub = optimization.states.profile.subscribe((nextProfile) => {
      setProfile(nextProfile)
    })
    const selectedOptimizationsSub = optimization.states.selectedOptimizations.subscribe(
      (nextSelectedOptimizations) => {
        setSelectedOptimizations(nextSelectedOptimizations)
      },
    )
    const previewPanelSub = optimization.states.previewPanelOpen.subscribe((isOpen) => {
      setPreviewPanelOpen(isOpen)
    })
    const eventSub = optimization.states.eventStream.subscribe((event) => {
      if (!event) return

      const timestamp = new Date().toLocaleTimeString()
      const eventName =
        event.type === 'track'
          ? `track:${event.event}`
          : event.type === 'identify'
            ? 'identify'
            : event.type === 'page'
              ? 'page'
              : event.type === 'screen'
                ? `screen:${event.name}`
                : event.type === 'component'
                  ? `component:${event.componentId}`
                  : event.type

      setEventLog((previous) =>
        [`${timestamp} ${eventName}`, ...previous].slice(0, MAX_EVENT_LOG_ITEMS),
      )
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
      selectedOptimizationsSub.unsubscribe()
      previewPanelSub.unsubscribe()
      eventSub.unsubscribe()
    }
  }, [optimization])

  return { consent, profile, selectedOptimizations, previewPanelOpen, eventLog }
}
