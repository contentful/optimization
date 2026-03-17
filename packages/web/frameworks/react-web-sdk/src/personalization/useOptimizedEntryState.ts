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
  const contentfulOptimization = useOptimization()
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
    const selectedPersonalizationsSubscription =
      contentfulOptimization.states.selectedPersonalizations.subscribe(
        (selectedPersonalizations: SelectedPersonalizationArray | undefined) => {
          setLockedSelectedPersonalizations(
            (previous: SelectedPersonalizationArray | undefined) => {
              if (shouldLiveUpdate) {
                return selectedPersonalizations
              }

              if (previous === undefined && selectedPersonalizations !== undefined) {
                return selectedPersonalizations
              }

              return previous
            },
          )
        },
      )

    const canPersonalizeSubscription = contentfulOptimization.states.canPersonalize.subscribe(
      (value) => {
        setCanPersonalize(value)
      },
    )

    return () => {
      selectedPersonalizationsSubscription.unsubscribe()
      canPersonalizeSubscription.unsubscribe()
    }
  }, [contentfulOptimization, shouldLiveUpdate])

  useEffect(() => {
    setSdkInitialized(true)
  }, [])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => contentfulOptimization.personalizeEntry(baselineEntry, lockedSelectedPersonalizations),
    [contentfulOptimization, baselineEntry, lockedSelectedPersonalizations],
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
