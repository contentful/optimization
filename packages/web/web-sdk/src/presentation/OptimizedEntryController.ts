import type {
  ContentfulEntryQuery,
  EntryFor,
  ManagedEntryDescriptor,
  Observable,
  OptimizedEntryMetadata,
  ResolvedData,
  Subscription,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type { ContentOptimizationHydrationMode } from '../handoff'
import {
  didSdkPresentationEnd,
  hasOptimizationReferences,
  isExperienceRequestSettled,
  isOptimizedEntryLoadingEntry,
  resolveShouldLiveUpdate,
  shouldResubscribe,
} from './OptimizedEntryControllerPredicates'
import type { OptimizedEntryLoadingTargetDisplay } from './OptimizedEntryLoadingPresentation'
import { resolveLoadingPresentation } from './OptimizedEntryLoadingPresentation'
import {
  areOptimizedEntrySnapshotsEqual,
  type OptimizedEntrySnapshot,
  type OptimizedEntrySnapshotListener,
} from './OptimizedEntrySnapshot'
import { resolveOptimizedEntryTrackingAttributes } from './OptimizedEntryTrackingAttributes'

export type { OptimizedEntryLoadingTargetDisplay } from './OptimizedEntryLoadingPresentation'
export type {
  OptimizedEntrySnapshot,
  OptimizedEntrySnapshotListener,
} from './OptimizedEntrySnapshot'
export { hasOptimizationReferences, resolveShouldLiveUpdate }

const BASELINE_REVEAL_TIMEOUT_MS = 5000

/**
 * Layout-neutral display value used by optimized-entry host elements.
 *
 * @public
 */
export const OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'

interface FetchContentfulEntry {
  (entryId: string, query?: ContentfulEntryQuery): Promise<Entry>
  (descriptor: Exclude<ManagedEntryDescriptor, string>): Promise<Entry>
}

/** Minimal SDK surface needed by optimized-entry presentation controllers. @public */
export interface OptimizedEntrySdk<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  /** SDK state observables used to resolve and track optimized entry content. */
  readonly states: {
    readonly canOptimize: Observable<boolean>
    readonly experienceRequestState: Observable<{ readonly status: string }>
    readonly optimizationPossible: Observable<boolean>
    readonly selectedOptimizations: Observable<SelectedOptimizationArray | undefined>
  }
  /** Resolve a Contentful entry against the currently selected optimizations. */
  resolveOptimizedEntry: (
    entry: EntryFor<S, M, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<S, M, L>
  fetchContentfulEntry: FetchContentfulEntry
}

/** Inputs used to configure an optimized-entry presentation controller. @public */
export interface OptimizedEntryControllerOptions<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  readonly hydration?: ContentOptimizationHydrationMode
  readonly isPresentationReady?: boolean
  /** Baseline Contentful entry fetched by the application. */
  readonly baselineEntry: EntryFor<S, M, L>
  readonly entryLiveUpdatesEnabled?: boolean
  readonly rootLiveUpdatesEnabled?: boolean
  readonly hasCustomLoadingFallback?: boolean
  readonly baselineRevealTimeoutMs?: number
  readonly isPreviewPanelOpen?: boolean
  /** SDK instance used for optimized entry resolution. */
  readonly sdk?: OptimizedEntrySdk<S, M, L>
  readonly isSdkStateReady?: boolean
  readonly targetDisplay?: OptimizedEntryLoadingTargetDisplay
  readonly clickable?: boolean
  readonly trackClicks?: boolean
  readonly trackHovers?: boolean
  readonly trackViews?: boolean
}

interface NormalizedOptimizedEntryControllerOptions<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
> extends OptimizedEntryControllerOptions<S, M, L> {
  readonly baselineRevealTimeoutMs: number
  readonly hasCustomLoadingFallback: boolean
  readonly hydration: ContentOptimizationHydrationMode
  readonly isPresentationReady: boolean
  readonly isPreviewPanelOpen: boolean
  readonly isSdkStateReady: boolean
  readonly rootLiveUpdatesEnabled: boolean
  readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
}

/**
 * Duplicate-baseline guard state for nested optimized entries.
 *
 * @public
 */
export interface OptimizedEntryNestingState {
  /** Baseline IDs for the current optimized entry and all optimized-entry ancestors. */
  readonly currentAndAncestorBaselineIds: ReadonlySet<string>
  /** Whether the current baseline ID already exists in an optimized-entry ancestor. */
  readonly hasDuplicateBaselineAncestor: boolean
}

function normalizeOptions<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(
  options: OptimizedEntryControllerOptions<S, M, L>,
): NormalizedOptimizedEntryControllerOptions<S, M, L> {
  return {
    hydration: options.hydration ?? 'client-only-hidden-until-ready',
    isPresentationReady: options.isPresentationReady ?? false,
    baselineEntry: options.baselineEntry,
    entryLiveUpdatesEnabled: options.entryLiveUpdatesEnabled,
    rootLiveUpdatesEnabled: options.rootLiveUpdatesEnabled ?? false,
    hasCustomLoadingFallback: options.hasCustomLoadingFallback ?? false,
    baselineRevealTimeoutMs: options.baselineRevealTimeoutMs ?? BASELINE_REVEAL_TIMEOUT_MS,
    isPreviewPanelOpen: options.isPreviewPanelOpen ?? false,
    sdk: options.sdk,
    isSdkStateReady: options.isSdkStateReady ?? false,
    targetDisplay: options.targetDisplay ?? 'block',
    clickable: options.clickable,
    trackClicks: options.trackClicks,
    trackHovers: options.trackHovers,
    trackViews: options.trackViews,
  }
}

/**
 * Resolve duplicate-baseline guard state for a nested optimized entry.
 *
 * @public
 */
export function resolveOptimizedEntryNestingState(
  baselineEntryId: string,
  ancestorBaselineIds: ReadonlySet<string> | null | undefined,
): OptimizedEntryNestingState {
  const hasDuplicateBaselineAncestor = ancestorBaselineIds?.has(baselineEntryId) ?? false
  const currentAndAncestorBaselineIds = new Set(ancestorBaselineIds ?? [])
  currentAndAncestorBaselineIds.add(baselineEntryId)

  return {
    currentAndAncestorBaselineIds,
    hasDuplicateBaselineAncestor,
  }
}

/**
 * Coordinates optimized-entry resolution, loading presentation, live updates, and tracking
 * attributes without depending on a specific UI framework.
 *
 * In the browser, the first usable presentation is committed for its baseline entry ID. Later SDK
 * state is display-inert by default, while effective live updates may apply later defined
 * selections. A different baseline entry ID starts a new presentation. Replacing the SDK or making
 * its state unready also ends and resets the current presentation, even when the baseline ID stays
 * the same.
 *
 * @public
 */
export class OptimizedEntryController<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  private canOptimize = false
  private connected = false
  private hasCommittedPresentation = false
  private experienceRequestStatus = 'idle'
  private optimizationPossible = true
  private listener: OptimizedEntrySnapshotListener<S, M, L> | undefined
  private baselineRevealTimeout: ReturnType<typeof setTimeout> | undefined
  private options: NormalizedOptimizedEntryControllerOptions<S, M, L>
  private hasBaselineRevealTimedOut = false
  private selectedOptimizations: SelectedOptimizationArray | undefined
  private snapshot: OptimizedEntrySnapshot<S, M, L>
  private subscriptions: Subscription[] = []

  constructor(options: OptimizedEntryControllerOptions<S, M, L>) {
    this.options = normalizeOptions(options)
    this.primeStateFromSdk()
    // A selection already present at construction is a synchronous seed, not later browser work.
    this.commitPresentationIfReady(true)
    this.snapshot = this.createSnapshot()
  }

  /** Register or clear the callback that receives snapshot updates. */
  setSnapshotListener(listener: OptimizedEntrySnapshotListener<S, M, L> | undefined): void {
    this.listener = listener
  }

  /** Subscribe to SDK state and start loading timeout management. */
  connect(): void {
    if (this.connected) {
      return
    }

    this.connected = true
    this.resubscribe()
    this.updateSnapshot()
  }

  /** Unsubscribe from SDK state and stop loading timeout management. */
  disconnect(): void {
    this.connected = false
    this.clearSubscriptions()
    this.clearLoadingRevealTimer()
  }

  /** Apply new controller options and recompute the current snapshot. */
  updateOptions(options: OptimizedEntryControllerOptions<S, M, L>): void {
    const { options: previousOptions } = this
    const previousShouldLiveUpdate = this.shouldLiveUpdate()
    const nextOptions = normalizeOptions(options)
    const sdkChanged = previousOptions.sdk !== nextOptions.sdk
    const sdkStateReadyChanged = previousOptions.isSdkStateReady !== nextOptions.isSdkStateReady
    const baselineChanged =
      previousOptions.baselineEntry.sys.id !== nextOptions.baselineEntry.sys.id
    const sdkPresentationEnded = didSdkPresentationEnd(
      previousOptions.sdk !== undefined,
      sdkChanged,
      previousOptions.isSdkStateReady,
      nextOptions.isSdkStateReady,
    )
    const shouldResetPresentation = baselineChanged || sdkPresentationEnded

    this.options = nextOptions

    if (shouldResetPresentation) {
      this.hasCommittedPresentation = false
      this.hasBaselineRevealTimedOut = false
      this.clearLoadingRevealTimer()
    }

    if (sdkChanged || nextOptions.sdk === undefined || !nextOptions.isSdkStateReady) {
      this.canOptimize = false
      this.experienceRequestStatus = 'idle'
      this.optimizationPossible = true
      this.selectedOptimizations = undefined
    }

    if (baselineChanged) {
      this.selectedOptimizations = undefined
      this.primeStateFromSdk()
    }

    const liveUpdateChanged = previousShouldLiveUpdate !== this.shouldLiveUpdate()
    if (this.connected && shouldResubscribe(sdkChanged, sdkStateReadyChanged, liveUpdateChanged)) {
      this.resubscribe()
    }

    this.updateSnapshot()
  }

  /** Return the latest optimized-entry snapshot. */
  getSnapshot(): OptimizedEntrySnapshot<S, M, L> {
    return this.snapshot
  }

  private shouldLiveUpdate(): boolean {
    return resolveShouldLiveUpdate({
      entryLiveUpdatesEnabled: this.options.entryLiveUpdatesEnabled,
      rootLiveUpdatesEnabled: this.options.rootLiveUpdatesEnabled,
      isPreviewPanelOpen: this.options.isPreviewPanelOpen,
    })
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe()
    })
    this.subscriptions = []
  }

  private primeStateFromSdk(): void {
    const { options } = this
    const { sdk, isSdkStateReady } = options
    if (!sdk || !isSdkStateReady) {
      return
    }

    const { states } = sdk
    const { canOptimize, experienceRequestState, optimizationPossible, selectedOptimizations } =
      states
    const { current: currentSelectedOptimizations } = selectedOptimizations
    const { current: currentCanOptimize } = canOptimize
    const {
      current: { status: currentExperienceRequestStatus },
    } = experienceRequestState
    const { current: currentOptimizationPossible } = optimizationPossible

    this.acceptSelectedOptimizations(currentSelectedOptimizations)
    this.canOptimize = currentCanOptimize
    this.experienceRequestStatus = currentExperienceRequestStatus
    this.optimizationPossible = currentOptimizationPossible
  }

  private resubscribe(): void {
    this.clearSubscriptions()

    const { options } = this
    const { sdk, isSdkStateReady } = options
    if (!sdk || !isSdkStateReady) {
      return
    }

    this.primeStateFromSdk()

    const { states } = sdk
    const { canOptimize, experienceRequestState, optimizationPossible, selectedOptimizations } =
      states

    this.subscriptions = [
      selectedOptimizations.subscribe((nextSelectedOptimizations) => {
        if (this.acceptSelectedOptimizations(nextSelectedOptimizations)) {
          this.updateSnapshot()
        }
      }),
      canOptimize.subscribe((nextCanOptimize) => {
        this.canOptimize = nextCanOptimize
        this.updateSnapshot()
      }),
      experienceRequestState.subscribe(({ status }) => {
        this.experienceRequestStatus = status
        this.updateSnapshot()
      }),
      optimizationPossible.subscribe((nextOptimizationPossible) => {
        this.optimizationPossible = nextOptimizationPossible
        this.updateSnapshot()
      }),
    ]
  }

  private acceptSelectedOptimizations(
    selectedOptimizations: SelectedOptimizationArray | undefined,
  ): boolean {
    if (selectedOptimizations === undefined) {
      return false
    }
    const canAcceptSelection =
      this.shouldLiveUpdate() ||
      (!this.hasCommittedPresentation && this.selectedOptimizations === undefined)
    if (!canAcceptSelection) {
      return false
    }
    this.selectedOptimizations = selectedOptimizations
    return true
  }

  private resolveIsLoading(): boolean {
    if (this.hasCommittedPresentation) {
      return false
    }

    if (isOptimizedEntryLoadingEntry(this.options.baselineEntry)) {
      return true
    }

    const requiresOptimization = hasOptimizationReferences(this.options.baselineEntry)
    const hasResolvedOptimizations = this.selectedOptimizations !== undefined
    const isContentReady =
      !requiresOptimization ||
      !this.optimizationPossible ||
      isExperienceRequestSettled(this.experienceRequestStatus) ||
      hasResolvedOptimizations

    const shouldHoldForBrowserPresentation =
      typeof window !== 'undefined' && !this.options.isPresentationReady

    return !isContentReady || shouldHoldForBrowserPresentation
  }

  private commitPresentationIfReady(acceptSynchronousSeed = false): void {
    const { options } = this
    const { baselineEntry } = options
    const { experienceRequestStatus, hasBaselineRevealTimedOut, hasCommittedPresentation } = this
    const hasExperienceRequestFailed = experienceRequestStatus === 'failed'
    const canCommitPresentation =
      typeof window !== 'undefined' &&
      !hasCommittedPresentation &&
      !isOptimizedEntryLoadingEntry(baselineEntry) &&
      this.hasCommitCandidate(acceptSynchronousSeed)

    if (!canCommitPresentation) {
      return
    }
    if (hasExperienceRequestFailed || hasBaselineRevealTimedOut) {
      this.selectedOptimizations = undefined
    }
    this.hasCommittedPresentation = true
  }

  private hasCommitCandidate(acceptSynchronousSeed: boolean): boolean {
    const { options } = this
    const { hydration, isPresentationReady } = options
    const hasSynchronousSeed = acceptSynchronousSeed && this.selectedOptimizations !== undefined
    const canCommitReadyPresentation = isPresentationReady && !this.resolveIsLoading()

    return (
      hydration === 'preserve-server' ||
      hasSynchronousSeed ||
      this.experienceRequestStatus === 'failed' ||
      this.hasBaselineRevealTimedOut ||
      canCommitReadyPresentation
    )
  }

  private createSnapshot(
    committedSnapshot?: OptimizedEntrySnapshot<S, M, L>,
  ): OptimizedEntrySnapshot<S, M, L> {
    const { options } = this
    const { baselineEntry } = options
    const isLoading = this.resolveIsLoading()
    const loadingPresentation = resolveLoadingPresentation({
      hasBaselineRevealTimedOut: this.hasBaselineRevealTimedOut,
      hasCustomLoadingFallback: options.hasCustomLoadingFallback,
      hydration: options.hydration,
      isLoading,
      isPresentationReady: options.isPresentationReady,
      isServerRender: typeof window === 'undefined',
      targetDisplay: options.targetDisplay,
    })
    const { showLoadingFallback } = loadingPresentation
    const keepsCommittedResolution =
      committedSnapshot !== undefined &&
      !this.shouldLiveUpdate() &&
      committedSnapshot.metadata.baselineEntryId === baselineEntry.sys.id
    const selectedOptimizations = keepsCommittedResolution
      ? committedSnapshot.selectedOptimizations
      : this.selectedOptimizations
    const resolvedData = keepsCommittedResolution
      ? committedSnapshot.resolvedData
      : options.sdk && options.isSdkStateReady
        ? options.sdk.resolveOptimizedEntry(baselineEntry, selectedOptimizations)
        : { entry: baselineEntry, selectedOptimization: undefined }
    const metadata: OptimizedEntryMetadata<S, M, L> = {
      baselineEntry,
      baselineEntryId: baselineEntry.sys.id,
      entry: resolvedData.entry,
      entryId: resolvedData.entry.sys.id,
      optimizationContextId: resolvedData.optimizationContextId,
      resolvedData,
      selectedOptimization: resolvedData.selectedOptimization,
      selectedOptimizations,
    }
    const isResolved = !isLoading && !showLoadingFallback

    return {
      canOptimize: this.canOptimize,
      entry: metadata.entry,
      hostAttributes: isResolved
        ? resolveOptimizedEntryTrackingAttributes(baselineEntry, resolvedData, options)
        : {},
      isEmptyVariant: resolvedData.isEmptyVariant === true,
      isLoading,
      isPresentationReady: options.isPresentationReady,
      isResolved,
      loadingPresentation,
      metadata,
      resolvedData,
      selectedOptimization: metadata.selectedOptimization,
      selectedOptimizations,
    }
  }

  private updateSnapshot(): void {
    const { hasCommittedPresentation: hadCommittedPresentation } = this
    this.commitPresentationIfReady()
    const isLoading = this.resolveIsLoading()

    if (!isLoading) {
      this.hasBaselineRevealTimedOut = false
    }

    const { snapshot: previousSnapshot } = this
    const nextSnapshot = this.createSnapshot(
      hadCommittedPresentation ? previousSnapshot : undefined,
    )
    this.snapshot = nextSnapshot
    const shouldRunLoadingRevealTimer =
      isLoading && !isOptimizedEntryLoadingEntry(this.options.baselineEntry)
    this.syncLoadingRevealTimer(shouldRunLoadingRevealTimer)

    if (!areOptimizedEntrySnapshotsEqual(previousSnapshot, nextSnapshot)) {
      this.listener?.(nextSnapshot)
    }
  }

  private syncLoadingRevealTimer(isLoading: boolean): void {
    const shouldClearTimer = !isLoading || this.hasBaselineRevealTimedOut
    if (shouldClearTimer) {
      this.clearLoadingRevealTimer()
    }
    if (!this.connected || shouldClearTimer) {
      return
    }

    if (this.baselineRevealTimeout !== undefined) {
      return
    }

    this.baselineRevealTimeout = setTimeout(() => {
      this.baselineRevealTimeout = undefined
      this.hasBaselineRevealTimedOut = true
      this.updateSnapshot()
    }, this.options.baselineRevealTimeoutMs)
  }

  private clearLoadingRevealTimer(): void {
    if (this.baselineRevealTimeout !== undefined) {
      clearTimeout(this.baselineRevealTimeout)
    }
    this.baselineRevealTimeout = undefined
  }
}
