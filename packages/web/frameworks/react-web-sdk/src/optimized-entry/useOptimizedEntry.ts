import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import {
  OptimizedEntryController,
  type OptimizedEntrySnapshot,
} from '@contentful/optimization-web/presentation'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimizationContext } from '../hooks/useOptimization'

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

export interface UseOptimizedEntrySnapshotParams extends UseOptimizedEntryParams {
  clickable?: boolean
  hasCustomLoadingFallback?: boolean
  hoverDurationUpdateIntervalMs?: number
  targetDisplay?: 'block' | 'inline'
  trackClicks?: boolean
  trackHovers?: boolean
  trackViews?: boolean
  viewDurationUpdateIntervalMs?: number
}

export function useOptimizedEntrySnapshot({
  baselineEntry,
  clickable,
  hasCustomLoadingFallback,
  hoverDurationUpdateIntervalMs,
  liveUpdates,
  targetDisplay,
  trackClicks,
  trackHovers,
  trackViews,
  viewDurationUpdateIntervalMs,
}: UseOptimizedEntrySnapshotParams): OptimizedEntrySnapshot {
  const { sdk, isReady } = useOptimizationContext()
  const liveUpdatesContext = useLiveUpdates()
  // Seed from context readiness so the server render (and the first client
  // render) presents resolved content instead of the loading state; effects,
  // which do not run on the server, would otherwise leave this false during SSR.
  const [isPresentationReady, setIsPresentationReady] = useState(isReady)

  const controllerOptions = useMemo(
    () => ({
      isPresentationReady,
      baselineEntry,
      entryLiveUpdatesEnabled: liveUpdates,
      rootLiveUpdatesEnabled: liveUpdatesContext.globalLiveUpdates,
      hasCustomLoadingFallback,
      isPreviewPanelOpen: liveUpdatesContext.previewPanelVisible,
      sdk,
      isSdkStateReady: isReady,
      targetDisplay,
      clickable,
      hoverDurationUpdateIntervalMs,
      trackClicks,
      trackHovers,
      trackViews,
      viewDurationUpdateIntervalMs,
    }),
    [
      isPresentationReady,
      baselineEntry,
      clickable,
      hasCustomLoadingFallback,
      hoverDurationUpdateIntervalMs,
      isReady,
      liveUpdates,
      liveUpdatesContext.globalLiveUpdates,
      liveUpdatesContext.previewPanelVisible,
      sdk,
      targetDisplay,
      trackClicks,
      trackHovers,
      trackViews,
      viewDurationUpdateIntervalMs,
    ],
  )
  const [controller] = useState(() => new OptimizedEntryController(controllerOptions))
  const [snapshot, setSnapshot] = useState<OptimizedEntrySnapshot>(() => controller.getSnapshot())

  useEffect(() => {
    setIsPresentationReady(isReady)
  }, [isReady])

  useEffect(() => {
    controller.setSnapshotListener(setSnapshot)
    return () => {
      controller.setSnapshotListener(undefined)
    }
  }, [controller])

  useEffect(() => {
    controller.updateOptions(controllerOptions)
    controller.connect()

    return () => {
      controller.disconnect()
    }
  }, [controller, controllerOptions])

  return snapshot
}

export function useOptimizedEntry(params: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const snapshot = useOptimizedEntrySnapshot(params)

  return {
    canOptimize: snapshot.canOptimize,
    entry: snapshot.entry,
    isLoading: snapshot.isLoading,
    isReady: snapshot.isReady,
    selectedOptimization: snapshot.selectedOptimization,
    resolvedData: snapshot.resolvedData,
    selectedOptimizations: snapshot.selectedOptimizations,
  }
}
