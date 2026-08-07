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

const BASELINE_REVEAL_TIMEOUT_MS = 5000

/**
 * Layout-neutral display value used by optimized-entry host elements.
 *
 * @public
 */
export const OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'

interface ExperienceRequestStateLike {
  readonly status: string
}

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
    readonly experienceRequestState: Observable<ExperienceRequestStateLike>
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
  readonly hoverDurationUpdateIntervalMs?: number
  readonly trackClicks?: boolean
  readonly trackHovers?: boolean
  readonly trackViews?: boolean
  readonly viewDurationUpdateIntervalMs?: number
}

interface NormalizedOptimizedEntryControllerOptions<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
> {
  readonly hydration: ContentOptimizationHydrationMode
  readonly isPresentationReady: boolean
  readonly baselineEntry: EntryFor<S, M, L>
  readonly entryLiveUpdatesEnabled?: boolean
  readonly rootLiveUpdatesEnabled: boolean
  readonly hasCustomLoadingFallback: boolean
  readonly baselineRevealTimeoutMs: number
  readonly isPreviewPanelOpen: boolean
  readonly sdk?: OptimizedEntrySdk<S, M, L>
  readonly isSdkStateReady: boolean
  readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
  readonly clickable?: boolean
  readonly hoverDurationUpdateIntervalMs?: number
  readonly trackClicks?: boolean
  readonly trackHovers?: boolean
  readonly trackViews?: boolean
  readonly viewDurationUpdateIntervalMs?: number
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
    hoverDurationUpdateIntervalMs: options.hoverDurationUpdateIntervalMs,
    trackClicks: options.trackClicks,
    trackHovers: options.trackHovers,
    trackViews: options.trackViews,
    viewDurationUpdateIntervalMs: options.viewDurationUpdateIntervalMs,
  }
}

/**
 * Return whether a Contentful entry contains optimization references.
 *
 * @public
 */
export function hasOptimizationReferences(entry: Entry): boolean {
  return Array.isArray(entry.fields.nt_experiences) && entry.fields.nt_experiences.length > 0
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
 * Resolve whether an optimized entry should react to later SDK state updates.
 *
 * @public
 */
export function resolveShouldLiveUpdate(params: {
  readonly entryLiveUpdatesEnabled: boolean | undefined
  readonly rootLiveUpdatesEnabled: boolean
  readonly isPreviewPanelOpen: boolean
}): boolean {
  const { entryLiveUpdatesEnabled, rootLiveUpdatesEnabled, isPreviewPanelOpen } = params

  if (isPreviewPanelOpen) {
    return true
  }

  return entryLiveUpdatesEnabled ?? rootLiveUpdatesEnabled
}

function createBaselineResolvedData<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(entry: EntryFor<S, M, L>): ResolvedData<S, M, L>
function createBaselineResolvedData(entry: Entry): ResolvedData<EntrySkeletonType>
function createBaselineResolvedData(entry: Entry): ResolvedData<EntrySkeletonType> {
  return { entry, selectedOptimization: undefined }
}

function isExperienceRequestSettled(state: ExperienceRequestStateLike): boolean {
  return state.status === 'success' || state.status === 'failed'
}

/**
 * Coordinates optimized-entry resolution, loading presentation, live updates, and tracking
 * attributes without depending on a specific UI framework.
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
  private hasExperienceRequestSettled = false
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

    this.options = nextOptions

    if (sdkChanged || !nextOptions.sdk || !nextOptions.isSdkStateReady) {
      this.canOptimize = false
      this.hasExperienceRequestSettled = false
      this.optimizationPossible = true
      this.selectedOptimizations = undefined
    }

    if (previousOptions.baselineEntry.sys.id !== nextOptions.baselineEntry.sys.id) {
      this.hasBaselineRevealTimedOut = false
      this.clearLoadingRevealTimer()
    }

    if (
      this.connected &&
      (sdkChanged || sdkStateReadyChanged || previousShouldLiveUpdate !== this.shouldLiveUpdate())
    ) {
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
    const { current: currentExperienceRequestState } = experienceRequestState
    const { current: currentOptimizationPossible } = optimizationPossible

    this.acceptSelectedOptimizations(currentSelectedOptimizations)
    this.canOptimize = currentCanOptimize
    this.hasExperienceRequestSettled = isExperienceRequestSettled(currentExperienceRequestState)
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
      experienceRequestState.subscribe((state) => {
        this.hasExperienceRequestSettled = isExperienceRequestSettled(state)
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
    if (this.shouldLiveUpdate()) {
      this.selectedOptimizations = selectedOptimizations
      return true
    }

    if (this.selectedOptimizations === undefined && selectedOptimizations !== undefined) {
      this.selectedOptimizations = selectedOptimizations
      return true
    }

    return false
  }

  private resolveIsLoading(): boolean {
    const requiresOptimization = hasOptimizationReferences(this.options.baselineEntry)
    const hasResolvedOptimizations = this.selectedOptimizations !== undefined
    const isContentReady =
      !requiresOptimization ||
      !this.optimizationPossible ||
      this.hasExperienceRequestSettled ||
      hasResolvedOptimizations

    return !isContentReady
  }

  private createSnapshot(): OptimizedEntrySnapshot<S, M, L> {
    const isLoading = this.resolveIsLoading()
    const isServerRender = typeof window === 'undefined'
    const loadingPresentation = resolveLoadingPresentation({
      hasBaselineRevealTimedOut: this.hasBaselineRevealTimedOut,
      hasCustomLoadingFallback: this.options.hasCustomLoadingFallback,
      hydration: this.options.hydration,
      isLoading,
      isPresentationReady: this.options.isPresentationReady,
      isServerRender,
      targetDisplay: this.options.targetDisplay,
    })
    const { showLoadingFallback } = loadingPresentation
    const resolvedData =
      this.options.sdk && this.options.isSdkStateReady
        ? this.options.sdk.resolveOptimizedEntry(
            this.options.baselineEntry,
            this.selectedOptimizations,
          )
        : createBaselineResolvedData(this.options.baselineEntry)
    const metadata: OptimizedEntryMetadata<S, M, L> = {
      baselineEntry: this.options.baselineEntry,
      baselineEntryId: this.options.baselineEntry.sys.id,
      entry: resolvedData.entry,
      entryId: resolvedData.entry.sys.id,
      optimizationContextId: resolvedData.optimizationContextId,
      resolvedData,
      selectedOptimization: resolvedData.selectedOptimization,
      selectedOptimizations: this.selectedOptimizations,
    }
    const isResolved = !isLoading && !showLoadingFallback

    return {
      canOptimize: this.canOptimize,
      entry: metadata.entry,
      hostAttributes: isResolved
        ? resolveOptimizedEntryTrackingAttributes(
            this.options.baselineEntry,
            resolvedData,
            this.options,
          )
        : {},
      isEmptyVariant: resolvedData.isEmptyVariant === true,
      isLoading,
      isPresentationReady: this.options.isPresentationReady,
      isResolved,
      loadingPresentation,
      metadata,
      resolvedData,
      selectedOptimization: metadata.selectedOptimization,
      selectedOptimizations: this.selectedOptimizations,
    }
  }

  private updateSnapshot(): void {
    const isLoading = this.resolveIsLoading()

    if (!isLoading) {
      this.hasBaselineRevealTimedOut = false
    }

    const nextSnapshot = this.createSnapshot()
    const { snapshot: previousSnapshot } = this
    this.snapshot = nextSnapshot
    this.syncLoadingRevealTimer(isLoading)

    if (!areOptimizedEntrySnapshotsEqual(previousSnapshot, nextSnapshot)) {
      this.listener?.(nextSnapshot)
    }
  }

  private syncLoadingRevealTimer(isLoading: boolean): void {
    if (!this.connected || !isLoading || this.hasBaselineRevealTimedOut) {
      if (!isLoading || this.hasBaselineRevealTimedOut) {
        this.clearLoadingRevealTimer()
      }
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
    if (this.baselineRevealTimeout === undefined) {
      return
    }

    clearTimeout(this.baselineRevealTimeout)
    this.baselineRevealTimeout = undefined
  }
}
