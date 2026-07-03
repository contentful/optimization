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
  /** Baseline Contentful entry fetched by the application. */
  baselineEntry: Entry
  /** Per-entry live-update override. */
  liveUpdates?: boolean
}

export interface UseOptimizedEntryResult {
  /** Whether SDK state says optimized content can be selected. */
  canOptimize: boolean
  /** Entry that should be rendered for the current hook state. */
  entry: Entry
  /** Whether the optimized entry is still waiting for optimization state. */
  isLoading: boolean
  /** Whether the client presentation layer is ready to reveal rendered content. */
  isPresentationReady: boolean
  /** Selected optimization that resolved the current entry, when one applied. */
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  /** Full resolved entry data returned by the SDK resolver. */
  resolvedData: ResolvedData<EntrySkeletonType>
  /** Selected optimization array used for this hook state. */
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

/**
 * Return the low-level optimized-entry presentation snapshot for a baseline entry.
 *
 * @public
 */
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
  const { sdk } = useOptimizationContext()
  const liveUpdatesContext = useLiveUpdates()
  const isSdkReady = sdk !== undefined
  const [isPresentationReady, setIsPresentationReady] = useState(isSdkReady)

  const controllerOptions = useMemo(
    () => ({
      isPresentationReady,
      baselineEntry,
      entryLiveUpdatesEnabled: liveUpdates,
      rootLiveUpdatesEnabled: liveUpdatesContext.globalLiveUpdates,
      hasCustomLoadingFallback,
      isPreviewPanelOpen: liveUpdatesContext.previewPanelVisible,
      sdk,
      isSdkStateReady: isSdkReady,
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
      isSdkReady,
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
    setIsPresentationReady(isSdkReady)
  }, [isSdkReady])

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

/**
 * Resolve a baseline entry and expose optimized-entry loading and metadata state.
 *
 * @public
 */
export function useOptimizedEntry(params: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const snapshot = useOptimizedEntrySnapshot(params)

  return {
    canOptimize: snapshot.canOptimize,
    entry: snapshot.entry,
    isLoading: snapshot.isLoading,
    isPresentationReady: snapshot.isPresentationReady,
    selectedOptimization: snapshot.selectedOptimization,
    resolvedData: snapshot.resolvedData,
    selectedOptimizations: snapshot.selectedOptimizations,
  }
}
