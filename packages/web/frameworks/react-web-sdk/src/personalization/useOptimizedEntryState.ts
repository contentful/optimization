import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimization } from '../hooks/useOptimization'
import {
  hasPersonalizationReferences,
  resolveShouldLiveUpdate,
  type OptimizedEntryChildren,
} from './optimizedEntryUtils'

interface UseOptimizedEntryStateParams {
  baselineEntry: Entry
  children: OptimizedEntryChildren
  liveUpdates: boolean | undefined
}

export interface UseOptimizedEntryStateResult {
  baselineChildren: OptimizedEntryChildren
  isLoading: boolean
  lockedSelectedPersonalizations: SelectedPersonalizationArray | undefined
  resolvedData: ResolvedData<EntrySkeletonType>
  sdkInitialized: boolean
}

export function useOptimizedEntryState({
  baselineEntry,
  children,
  liveUpdates,
}: UseOptimizedEntryStateParams): UseOptimizedEntryStateResult {
  const { sdk, isReady } = useOptimization()
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
    baselineChildren: children,
    isLoading: !isContentReady,
    lockedSelectedPersonalizations,
    resolvedData,
    sdkInitialized,
  }
}
