import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ContentfulEntryQuery, ResolvedData } from '@contentful/optimization-web/core-sdk'
import {
  createOptimizedEntryLoadingEntry,
  OptimizedEntryController,
  OptimizedEntrySourceController,
  type OptimizedEntryMetadata,
  type OptimizedEntrySnapshot,
  type OptimizedEntrySourceSnapshot,
} from '@contentful/optimization-web/presentation'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimizationContext } from '../hooks/useOptimization'

export type UseOptimizedEntryParams = {
  liveUpdates?: boolean
  onEntryError?: (error: Error) => void
} & (
  | {
      baselineEntry: Entry
      entryId?: never
      entryQuery?: never
    }
  | {
      baselineEntry?: never
      entryId: string
      entryQuery?: ContentfulEntryQuery
    }
)

interface UseManagedBaselineEntryResult {
  readonly entry: Entry | undefined
  readonly error: Error | undefined
  readonly isLoading: boolean
}

type UseOptimizedEntryBaselineParams = Extract<UseOptimizedEntryParams, { baselineEntry: Entry }>
type UseOptimizedEntryManagedParams = Extract<UseOptimizedEntryParams, { entryId: string }>

export interface UseOptimizedEntryResult<TEntry extends Entry | undefined = Entry | undefined> {
  canOptimize: boolean
  entry: TEntry
  baselineEntry: TEntry
  error: Error | undefined
  isLoading: boolean
  isReady: boolean
  isResolved: boolean
  metadata: OptimizedEntryMetadata | undefined
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  resolvedData: ResolvedData<EntrySkeletonType>
  selectedOptimizations: SelectedOptimizationArray | undefined
}

export interface UseOptimizedEntrySnapshotParams {
  baselineEntry: Entry
  clickable?: boolean
  hasCustomLoadingFallback?: boolean
  hoverDurationUpdateIntervalMs?: number
  liveUpdates?: boolean
  targetDisplay?: 'block' | 'inline'
  trackClicks?: boolean
  trackHovers?: boolean
  trackViews?: boolean
  viewDurationUpdateIntervalMs?: number
}

function getEntryQueryKey(query: ContentfulEntryQuery | undefined): string {
  return JSON.stringify(query ?? {})
}

export function useManagedBaselineEntry({
  baselineEntry,
  entryId,
  entryQuery,
  onEntryError,
}: UseOptimizedEntryParams): UseManagedBaselineEntryResult {
  const { sdk, isReady } = useOptimizationContext()
  const entryQueryKey = getEntryQueryKey(entryQuery)
  const [controller] = useState(() => new OptimizedEntrySourceController())
  const [snapshot, setSnapshot] = useState<OptimizedEntrySourceSnapshot>(() => {
    if (baselineEntry !== undefined) {
      return { baselineEntry, isLoading: false }
    }

    return { entryId, isLoading: true }
  })
  const reportedErrorRef = useRef<Error | undefined>(undefined)

  useEffect(() => {
    controller.setSnapshotListener(setSnapshot)

    return () => {
      controller.setSnapshotListener(undefined)
      controller.disconnect()
    }
  }, [controller])

  useEffect(() => {
    controller.updateOptions({
      baselineEntry,
      entryId,
      entryQuery,
      sdk,
      isSdkStateReady: isReady,
    })
  }, [baselineEntry, controller, entryId, entryQuery, entryQueryKey, isReady, sdk])

  useEffect(() => {
    const { error } = snapshot
    if (error === undefined) {
      reportedErrorRef.current = undefined
      return
    }

    if (reportedErrorRef.current === error) {
      return
    }

    reportedErrorRef.current = error
    onEntryError?.(error)
  }, [onEntryError, snapshot])

  if (baselineEntry !== undefined) {
    return { entry: baselineEntry, error: undefined, isLoading: false }
  }

  return {
    entry: snapshot.baselineEntry,
    error: snapshot.error,
    isLoading: snapshot.isLoading,
  }
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
  const [isPresentationReady, setIsPresentationReady] = useState(false)

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

export function useOptimizedEntry(
  params: UseOptimizedEntryBaselineParams,
): UseOptimizedEntryResult<Entry>
export function useOptimizedEntry(params: UseOptimizedEntryManagedParams): UseOptimizedEntryResult
export function useOptimizedEntry(params: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const managedEntry = useManagedBaselineEntry(params)
  const loadingEntryId = (params as { readonly entryId?: string }).entryId ?? 'contentful-entry'
  const loadingEntry = useMemo(
    () => createOptimizedEntryLoadingEntry(loadingEntryId),
    [loadingEntryId],
  )
  const baselineEntry = managedEntry.entry ?? loadingEntry
  const snapshot = useOptimizedEntrySnapshot({
    baselineEntry,
    liveUpdates: params.liveUpdates,
  })
  const hasEntry = managedEntry.entry !== undefined

  return {
    canOptimize: snapshot.canOptimize,
    entry: hasEntry ? snapshot.entry : undefined,
    baselineEntry: managedEntry.entry,
    error: managedEntry.error,
    isLoading: managedEntry.isLoading || snapshot.isLoading,
    isReady: hasEntry && snapshot.isReady,
    isResolved: hasEntry && snapshot.isResolved,
    metadata: hasEntry ? snapshot.metadata : undefined,
    selectedOptimization: hasEntry ? snapshot.selectedOptimization : undefined,
    resolvedData: snapshot.resolvedData,
    selectedOptimizations: hasEntry ? snapshot.selectedOptimizations : undefined,
  }
}
