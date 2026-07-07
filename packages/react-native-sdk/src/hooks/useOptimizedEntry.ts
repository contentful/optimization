import type { OptimizedEntryMetadata, ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import { isResolvedOptimizedEntry } from '@contentful/optimization-core/api-schemas'
import {
  createOptimizedEntryLoadingEntry,
  getOptimizedEntrySourceKey,
  OptimizedEntrySourceController,
  type ContentfulEntryQuery,
  type OptimizedEntrySourceSnapshot,
} from '@contentful/optimization-core/entry-source'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveUpdates } from '../context/LiveUpdatesContext'
import { useOptimization } from '../context/OptimizationContext'

/**
 * Source and behavior options for {@link useOptimizedEntry}.
 *
 * @public
 */
export type UseOptimizedEntryParams = {
  liveUpdates?: boolean
  onEntryError?: (error: Error) => void
  onEntryResolved?: (metadata: OptimizedEntryMetadata) => void
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

type UseOptimizedEntryBaselineParams = Extract<UseOptimizedEntryParams, { baselineEntry: Entry }>

interface UseManagedBaselineEntryResult {
  readonly entry: Entry | undefined
  readonly error: Error | undefined
  readonly isLoading: boolean
}

/**
 * Resolved entry state returned by {@link useOptimizedEntry}.
 *
 * @public
 */
export interface UseOptimizedEntryResult<TEntry extends Entry | undefined = Entry | undefined> {
  readonly entry: TEntry
  readonly baselineEntry: TEntry
  readonly error: Error | undefined
  readonly isLoading: boolean
  /** Whether the presentation layer can render resolved entry content. */
  readonly isPresentationReady: boolean
  readonly isResolved: boolean
  readonly metadata: OptimizedEntryMetadata | undefined
  readonly selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}

function useManagedBaselineEntry({
  baselineEntry,
  entryId,
  entryQuery,
  onEntryError,
}: UseOptimizedEntryParams): UseManagedBaselineEntryResult {
  const sdk = useOptimization()
  const entrySourceKey =
    entryId === undefined ? undefined : getOptimizedEntrySourceKey(entryId, entryQuery)
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
      isSdkStateReady: true,
    })
  }, [baselineEntry, controller, entryId, entrySourceKey, sdk])

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

function useResolvedEntryData(
  baselineEntry: Entry | undefined,
  loadingEntry: Entry,
  liveUpdates: boolean | undefined,
): {
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
} {
  const sdk = useOptimization()
  const liveUpdatesContext = useLiveUpdates()
  const isOptimized = baselineEntry !== undefined && isResolvedOptimizedEntry(baselineEntry)
  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)
  const [lockedSelectedOptimizations, setLockedSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)
  const isLockedRef = useRef(false)

  useEffect(() => {
    if (shouldLiveUpdate) {
      isLockedRef.current = false
    }
  }, [shouldLiveUpdate])

  useEffect(() => {
    if (!isOptimized) return

    const subscription = sdk.states.selectedOptimizations.subscribe((nextSelectedOptimizations) => {
      if (shouldLiveUpdate) {
        setLockedSelectedOptimizations(nextSelectedOptimizations)
      } else if (!isLockedRef.current && nextSelectedOptimizations !== undefined) {
        isLockedRef.current = true
        setLockedSelectedOptimizations(nextSelectedOptimizations)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk, shouldLiveUpdate, isOptimized])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(() => {
    if (baselineEntry === undefined) {
      return { entry: loadingEntry }
    }

    return isOptimized
      ? sdk.resolveOptimizedEntry(baselineEntry, lockedSelectedOptimizations)
      : { entry: baselineEntry }
  }, [baselineEntry, isOptimized, loadingEntry, lockedSelectedOptimizations, sdk])

  return {
    resolvedData,
    selectedOptimizations: isOptimized ? lockedSelectedOptimizations : undefined,
  }
}

/**
 * Fetches or accepts a baseline Contentful entry, resolves the selected variant, and returns
 * render-ready entry state for React Native components.
 *
 * @remarks
 * Pass `entryId` when the SDK is configured with `contentful.client`. Pass `baselineEntry` to keep
 * manual application-owned Contentful fetching unchanged.
 *
 * @public
 */
export function useOptimizedEntry(
  params: UseOptimizedEntryBaselineParams,
): UseOptimizedEntryResult<Entry>
export function useOptimizedEntry(params: UseOptimizedEntryParams): UseOptimizedEntryResult
export function useOptimizedEntry(params: UseOptimizedEntryParams): UseOptimizedEntryResult {
  const managedEntry = useManagedBaselineEntry(params)
  const loadingEntryId = (params as { readonly entryId?: string }).entryId ?? 'contentful-entry'
  const loadingEntry = useMemo(
    () => createOptimizedEntryLoadingEntry(loadingEntryId),
    [loadingEntryId],
  )
  const { resolvedData, selectedOptimizations } = useResolvedEntryData(
    managedEntry.entry,
    loadingEntry,
    params.liveUpdates,
  )
  const hasEntry = managedEntry.entry !== undefined
  const metadata = useMemo<OptimizedEntryMetadata | undefined>(
    () =>
      hasEntry
        ? {
            baselineEntry: managedEntry.entry,
            baselineEntryId: managedEntry.entry.sys.id,
            entry: resolvedData.entry,
            entryId: resolvedData.entry.sys.id,
            optimizationContextId: resolvedData.optimizationContextId,
            resolvedData,
            selectedOptimization: resolvedData.selectedOptimization,
            selectedOptimizations,
          }
        : undefined,
    [hasEntry, managedEntry.entry, resolvedData, selectedOptimizations],
  )
  const { onEntryResolved } = params
  const lastResolvedMetadataRef = useRef<OptimizedEntryMetadata | undefined>(undefined)

  useEffect(() => {
    if (metadata === undefined) {
      lastResolvedMetadataRef.current = undefined
      return
    }

    if (lastResolvedMetadataRef.current === metadata) {
      return
    }

    lastResolvedMetadataRef.current = metadata
    onEntryResolved?.(metadata)
  }, [metadata, onEntryResolved])

  return {
    entry: hasEntry ? resolvedData.entry : undefined,
    baselineEntry: managedEntry.entry,
    error: managedEntry.error,
    isLoading: managedEntry.isLoading,
    isPresentationReady: hasEntry,
    isResolved: hasEntry,
    metadata,
    selectedOptimization: hasEntry ? resolvedData.selectedOptimization : undefined,
    resolvedData,
    selectedOptimizations: hasEntry ? selectedOptimizations : undefined,
  }
}
