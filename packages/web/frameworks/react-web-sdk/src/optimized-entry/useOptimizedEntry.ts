import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ContentfulEntryQuery, ResolvedData } from '@contentful/optimization-web/core-sdk'
import {
  createOptimizedEntryLoadingEntry,
  getOptimizedEntrySourceKey,
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
  /** Per-entry live-update override. */
  liveUpdates?: boolean
  /** Callback invoked when SDK-managed entry fetching fails. */
  onEntryError?: (error: Error) => void
} & (
  | {
      /** Baseline Contentful entry fetched by the application. */
      baselineEntry: Entry
      entryId?: never
      entryQuery?: never
    }
  | {
      baselineEntry?: never
      /** Contentful entry ID fetched through the SDK-managed Contentful client. */
      entryId: string
      /** Per-call Contentful `getEntry()` query overrides. */
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
  /** Whether SDK state says optimized content can be selected. */
  canOptimize: boolean
  /** Baseline entry used for resolution, or `undefined` while managed fetching is unresolved. */
  baselineEntry: TEntry
  /** Entry that should be rendered for the current hook state. */
  entry: TEntry
  /** Error from SDK-managed entry fetching, when one occurred. */
  error: Error | undefined
  /** Whether the optimized entry is still waiting for content or optimization state. */
  isLoading: boolean
  /** Whether the client presentation layer is ready to reveal rendered content. */
  isPresentationReady: boolean
  /** Whether the current entry has been resolved and metadata can be consumed. */
  isResolved: boolean
  /** Baseline, resolved-entry, and optimization metadata for render surfaces. */
  metadata: OptimizedEntryMetadata | undefined
  /** Full resolved entry data returned by the SDK resolver. */
  resolvedData: ResolvedData<EntrySkeletonType>
  /** Selected optimization that resolved the current entry, when one applied. */
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  /** Selected optimization array used for this hook state. */
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

export function useManagedBaselineEntry({
  baselineEntry,
  entryId,
  entryQuery,
  onEntryError,
}: UseOptimizedEntryParams): UseManagedBaselineEntryResult {
  const optimizationContext = useOptimizationContext()
  const { sdk, serverOptimizedEntries } = optimizationContext
  const isSdkLive = optimizationContext.isLive ?? sdk !== undefined
  const entrySourceKey =
    entryId === undefined ? undefined : getOptimizedEntrySourceKey(entryId, entryQuery)
  const handoffEntry =
    entrySourceKey === undefined ? undefined : serverOptimizedEntries?.get(entrySourceKey)
  const effectiveBaselineEntry = baselineEntry ?? handoffEntry
  const [controller] = useState(() => new OptimizedEntrySourceController())
  const [snapshot, setSnapshot] = useState<OptimizedEntrySourceSnapshot>(() => {
    if (effectiveBaselineEntry !== undefined) {
      return { baselineEntry: effectiveBaselineEntry, isLoading: false }
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
      baselineEntry: effectiveBaselineEntry,
      entryId,
      entryQuery,
      sdk,
      isSdkStateReady: isSdkLive,
    })
  }, [controller, effectiveBaselineEntry, entryId, entryQuery, entrySourceKey, isSdkLive, sdk])

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

  if (effectiveBaselineEntry !== undefined) {
    return { entry: effectiveBaselineEntry, error: undefined, isLoading: false }
  }

  return {
    entry: snapshot.baselineEntry,
    error: snapshot.error,
    isLoading: snapshot.isLoading,
  }
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
  const isPresentationReady = hasEntry && snapshot.isPresentationReady

  return {
    canOptimize: snapshot.canOptimize,
    baselineEntry: managedEntry.entry,
    entry: hasEntry ? snapshot.entry : undefined,
    error: managedEntry.error,
    isLoading: managedEntry.isLoading || snapshot.isLoading,
    isPresentationReady,
    isResolved: hasEntry && snapshot.isResolved,
    metadata: hasEntry ? snapshot.metadata : undefined,
    resolvedData: snapshot.resolvedData,
    selectedOptimization: hasEntry ? snapshot.selectedOptimization : undefined,
    selectedOptimizations: hasEntry ? snapshot.selectedOptimizations : undefined,
  }
}
