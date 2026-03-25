import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimizationContext } from '../hooks/useOptimization'
import { hasOptimizationReferences, resolveShouldLiveUpdate } from './optimizedEntryUtils'

export interface UseOptimizedEntryParams {
  baselineEntry: Entry
  liveUpdates?: boolean
}

export interface UseOptimizedEntryResult {
  canOptimize: boolean
  entry: Entry
  isLoading: boolean
  isReady: boolean
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  resolvedData: ResolvedData<EntrySkeletonType>
  selectedOptimizations: SelectedOptimizationArray | undefined
}

export function useOptimizedEntry({
  baselineEntry,
  liveUpdates,
}: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const { sdk, isReady } = useOptimizationContext()
  const liveUpdatesContext = useLiveUpdates()
  const [lockedSelectedOptimizations, setLockedSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)
  const [canOptimize, setCanOptimize] = useState(false)
  const [sdkInitialized, setSdkInitialized] = useState(false)

  const shouldLiveUpdate = resolveShouldLiveUpdate({
    componentLiveUpdates: liveUpdates,
    globalLiveUpdates: liveUpdatesContext.globalLiveUpdates,
    previewPanelVisible: liveUpdatesContext.previewPanelVisible,
  })

  useEffect(() => {
    if (!sdk || !isReady) {
      setCanOptimize(false)
      return
    }

    const selectedOptimizationsSubscription = sdk.states.selectedOptimizations.subscribe(
      (selectedOptimizations: SelectedOptimizationArray | undefined) => {
        setLockedSelectedOptimizations((previous: SelectedOptimizationArray | undefined) => {
          if (shouldLiveUpdate) {
            return selectedOptimizations
          }

          if (previous === undefined && selectedOptimizations !== undefined) {
            return selectedOptimizations
          }

          return previous
        })
      },
    )

    const canOptimizeSubscription = sdk.states.canOptimize.subscribe((value) => {
      setCanOptimize(value)
    })

    return () => {
      selectedOptimizationsSubscription.unsubscribe()
      canOptimizeSubscription.unsubscribe()
    }
  }, [isReady, sdk, shouldLiveUpdate])

  useEffect(() => {
    setSdkInitialized(isReady)
  }, [isReady])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () =>
      sdk && isReady
        ? sdk.resolveOptimizedEntry(baselineEntry, lockedSelectedOptimizations)
        : { entry: baselineEntry, selectedOptimization: undefined },
    [baselineEntry, isReady, lockedSelectedOptimizations, sdk],
  )

  const requiresOptimization = hasOptimizationReferences(baselineEntry)
  const isContentReady = requiresOptimization ? canOptimize : true

  return {
    canOptimize,
    entry: resolvedData.entry,
    isLoading: !isContentReady,
    isReady: sdkInitialized,
    selectedOptimization: resolvedData.selectedOptimization,
    resolvedData,
    selectedOptimizations: lockedSelectedOptimizations,
  }
}
