import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimizationContext } from '../hooks/useOptimization'
import { hasPersonalizationReferences, resolveShouldLiveUpdate } from './optimizedEntryUtils'

export interface UseOptimizedEntryParams {
  baselineEntry: Entry
  liveUpdates?: boolean
}

export interface UseOptimizedEntryResult {
  canPersonalize: boolean
  entry: Entry
  isLoading: boolean
  isReady: boolean
  personalization: ResolvedData<EntrySkeletonType>['personalization']
  resolvedData: ResolvedData<EntrySkeletonType>
  selectedPersonalizations: SelectedPersonalizationArray | undefined
}

export function useOptimizedEntry({
  baselineEntry,
  liveUpdates,
}: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const { sdk, isReady } = useOptimizationContext()
  const liveUpdatesContext = useLiveUpdates()
  const [lockedSelectedPersonalizations, setLockedSelectedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)
  const [canPersonalize, setCanPersonalize] = useState(false)
  const [sdkInitialized, setSdkInitialized] = useState(false)

  const shouldLiveUpdate = resolveShouldLiveUpdate({
    componentLiveUpdates: liveUpdates,
    globalLiveUpdates: liveUpdatesContext.globalLiveUpdates,
    previewPanelVisible: liveUpdatesContext.previewPanelVisible,
  })

  useEffect(() => {
    if (!sdk || !isReady) {
      setCanPersonalize(false)
      return
    }

    const selectedPersonalizationsSubscription = sdk.states.selectedPersonalizations.subscribe(
      (selectedPersonalizations: SelectedPersonalizationArray | undefined) => {
        setLockedSelectedPersonalizations((previous: SelectedPersonalizationArray | undefined) => {
          if (shouldLiveUpdate) {
            return selectedPersonalizations
          }

          if (previous === undefined && selectedPersonalizations !== undefined) {
            return selectedPersonalizations
          }

          return previous
        })
      },
    )

    const canPersonalizeSubscription = sdk.states.canPersonalize.subscribe((value) => {
      setCanPersonalize(value)
    })

    return () => {
      selectedPersonalizationsSubscription.unsubscribe()
      canPersonalizeSubscription.unsubscribe()
    }
  }, [isReady, sdk, shouldLiveUpdate])

  useEffect(() => {
    setSdkInitialized(isReady)
  }, [isReady])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () =>
      sdk && isReady
        ? sdk.personalizeEntry(baselineEntry, lockedSelectedPersonalizations)
        : { entry: baselineEntry, personalization: undefined },
    [baselineEntry, isReady, lockedSelectedPersonalizations, sdk],
  )

  const requiresPersonalization = hasPersonalizationReferences(baselineEntry)
  const isContentReady = requiresPersonalization ? canPersonalize : true

  return {
    canPersonalize,
    entry: resolvedData.entry,
    isLoading: !isContentReady,
    isReady: sdkInitialized,
    personalization: resolvedData.personalization,
    resolvedData,
    selectedPersonalizations: lockedSelectedPersonalizations,
  }
}
