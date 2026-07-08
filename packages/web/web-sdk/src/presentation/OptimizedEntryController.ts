import type {
  ContentfulEntryQuery,
  Observable,
  OptimizedEntryMetadata,
  ResolvedData,
  Subscription,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import {
  resolveOptimizedEntryTrackingAttributes,
  type OptimizedEntryTrackingAttributes,
} from './OptimizedEntryTrackingAttributes'

const BASELINE_REVEAL_TIMEOUT_MS = 5000

/**
 * Display mode used for the temporary loading layout target.
 *
 * @public
 */
export type OptimizedEntryLoadingTargetDisplay = 'block' | 'inline'

/**
 * Layout-neutral display value used by optimized-entry host elements.
 *
 * @public
 */
export const OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'

interface ExperienceRequestStateLike {
  readonly status: string
}

/**
 * Minimal SDK surface needed by optimized-entry presentation controllers.
 *
 * @public
 */
export interface OptimizedEntrySdk {
  /** SDK state observables used to resolve and track optimized entry content. */
  readonly states: {
    readonly canOptimize: Observable<boolean>
    readonly experienceRequestState: Observable<ExperienceRequestStateLike>
    readonly optimizationPossible: Observable<boolean>
    readonly selectedOptimizations: Observable<SelectedOptimizationArray | undefined>
  }
  /** Resolve a Contentful entry against the currently selected optimizations. */
  resolveOptimizedEntry: (
    entry: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<EntrySkeletonType>
  fetchContentfulEntry: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
}

/**
 * Current presentation state for one optimized entry.
 *
 * @public
 */
export interface OptimizedEntrySnapshot {
  /** Whether SDK state says optimized content can be selected. */
  readonly canOptimize: boolean
  /** Entry that should be rendered for the current snapshot. */
  readonly entry: Entry
  /** Host attributes needed for automatic entry interaction tracking. */
  readonly hostAttributes: OptimizedEntryTrackingAttributes
  /** Whether the optimized entry is still waiting for optimization state. */
  readonly isLoading: boolean
  /** Whether the client presentation layer is ready to reveal rendered content. */
  readonly isPresentationReady: boolean
  /** Whether the current entry has been resolved and can be exposed to render callbacks. */
  readonly isResolved: boolean
  /** Loading and fallback rendering decisions for wrappers around the entry. */
  readonly loadingPresentation: {
    readonly showLoadingFallback: boolean
    readonly hideLoadingLayoutTarget: boolean
    readonly shouldRenderBaselineWhileLoading: boolean
    readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
  }
  /** Baseline, resolved-entry, and optimization metadata for render surfaces. */
  readonly metadata: OptimizedEntryMetadata
  /** Full resolved entry data returned by the SDK resolver. */
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  /** Selected optimization that resolved the current entry, when one applied. */
  readonly selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  /** Selected optimization array used for this snapshot. */
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}

/**
 * Inputs used to configure an {@link OptimizedEntryController}.
 *
 * @public
 */
export interface OptimizedEntryControllerOptions {
  /** Whether the client presentation layer is ready to reveal rendered content. */
  readonly isPresentationReady?: boolean
  /** Baseline Contentful entry fetched by the application. */
  readonly baselineEntry: Entry
  /** Per-entry live-update override. */
  readonly entryLiveUpdatesEnabled?: boolean
  /** Root-level live-update setting inherited by entries without an override. */
  readonly rootLiveUpdatesEnabled?: boolean
  /** Whether the wrapper has its own loading fallback UI. */
  readonly hasCustomLoadingFallback?: boolean
  /** Delay before baseline content is revealed while optimization remains unresolved. */
  readonly baselineRevealTimeoutMs?: number
  /** Whether the preview panel is open and should force live updates. */
  readonly isPreviewPanelOpen?: boolean
  /** SDK instance used for optimized entry resolution. */
  readonly sdk?: OptimizedEntrySdk
  /** Whether SDK state observables are ready to read. */
  readonly isSdkStateReady?: boolean
  /** Display mode for the temporary loading layout target. */
  readonly targetDisplay?: OptimizedEntryLoadingTargetDisplay
  /** Whether the wrapper should be marked as a click target. */
  readonly clickable?: boolean
  /** Hover duration update interval in milliseconds. */
  readonly hoverDurationUpdateIntervalMs?: number
  /** Per-entry click tracking override. */
  readonly trackClicks?: boolean
  /** Per-entry hover tracking override. */
  readonly trackHovers?: boolean
  /** Per-entry view tracking override. */
  readonly trackViews?: boolean
  /** View duration update interval in milliseconds. */
  readonly viewDurationUpdateIntervalMs?: number
}

/**
 * Receives optimized-entry snapshot updates.
 *
 * @public
 */
export type OptimizedEntrySnapshotListener = (snapshot: OptimizedEntrySnapshot) => void

interface NormalizedOptimizedEntryControllerOptions {
  readonly isPresentationReady: boolean
  readonly baselineEntry: Entry
  readonly entryLiveUpdatesEnabled?: boolean
  readonly rootLiveUpdatesEnabled: boolean
  readonly hasCustomLoadingFallback: boolean
  readonly baselineRevealTimeoutMs: number
  readonly isPreviewPanelOpen: boolean
  readonly sdk?: OptimizedEntrySdk
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

function normalizeOptions(
  options: OptimizedEntryControllerOptions,
): NormalizedOptimizedEntryControllerOptions {
  return {
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

function createBaselineResolvedData(entry: Entry): ResolvedData<EntrySkeletonType> {
  return { entry, selectedOptimization: undefined }
}

function isExperienceRequestSettled(state: ExperienceRequestStateLike): boolean {
  return state.status === 'success' || state.status === 'failed'
}

function areHostAttributesEqual(
  left: OptimizedEntryTrackingAttributes,
  right: OptimizedEntryTrackingAttributes,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

function areLoadingPresentationsEqual(
  left: OptimizedEntrySnapshot['loadingPresentation'],
  right: OptimizedEntrySnapshot['loadingPresentation'],
): boolean {
  return (
    left.showLoadingFallback === right.showLoadingFallback &&
    left.hideLoadingLayoutTarget === right.hideLoadingLayoutTarget &&
    left.shouldRenderBaselineWhileLoading === right.shouldRenderBaselineWhileLoading &&
    left.targetDisplay === right.targetDisplay
  )
}

function areSnapshotMetadataEqual(
  left: OptimizedEntrySnapshot['metadata'],
  right: OptimizedEntrySnapshot['metadata'],
): boolean {
  return (
    left.baselineEntry === right.baselineEntry &&
    left.optimizationContextId === right.optimizationContextId
  )
}

function areSnapshotValuesEqual(
  left: OptimizedEntrySnapshot,
  right: OptimizedEntrySnapshot,
): boolean {
  return (
    left.canOptimize === right.canOptimize &&
    left.entry === right.entry &&
    left.isLoading === right.isLoading &&
    left.isPresentationReady === right.isPresentationReady &&
    left.isResolved === right.isResolved &&
    left.selectedOptimization === right.selectedOptimization &&
    left.selectedOptimizations === right.selectedOptimizations
  )
}

function areSnapshotsEqual(left: OptimizedEntrySnapshot, right: OptimizedEntrySnapshot): boolean {
  return (
    areSnapshotValuesEqual(left, right) &&
    areSnapshotMetadataEqual(left.metadata, right.metadata) &&
    areLoadingPresentationsEqual(left.loadingPresentation, right.loadingPresentation) &&
    areHostAttributesEqual(left.hostAttributes, right.hostAttributes)
  )
}

/**
 * Coordinates optimized-entry resolution, loading presentation, live updates, and tracking
 * attributes without depending on a specific UI framework.
 *
 * @public
 */
export class OptimizedEntryController {
  private canOptimize = false
  private connected = false
  private hasExperienceRequestSettled = false
  private optimizationPossible = true
  private listener: OptimizedEntrySnapshotListener | undefined
  private baselineRevealTimeout: ReturnType<typeof setTimeout> | undefined
  private options: NormalizedOptimizedEntryControllerOptions
  private hasBaselineRevealTimedOut = false
  private selectedOptimizations: SelectedOptimizationArray | undefined
  private snapshot: OptimizedEntrySnapshot
  private subscriptions: Subscription[] = []

  constructor(options: OptimizedEntryControllerOptions) {
    this.options = normalizeOptions(options)
    this.primeStateFromSdk()
    this.snapshot = this.createSnapshot()
  }

  /** Register or clear the callback that receives snapshot updates. */
  setSnapshotListener(listener: OptimizedEntrySnapshotListener | undefined): void {
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
  updateOptions(options: OptimizedEntryControllerOptions): void {
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
  getSnapshot(): OptimizedEntrySnapshot {
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

  private createSnapshot(): OptimizedEntrySnapshot {
    const isLoading = this.resolveIsLoading()
    const isServerRender = typeof window === 'undefined'
    const showLoadingFallback = isLoading || (isServerRender && !this.options.isPresentationReady)
    const shouldRenderBaselineWhileLoading =
      !this.options.hasCustomLoadingFallback || this.hasBaselineRevealTimedOut
    const hideLoadingLayoutTarget =
      isServerRender || (shouldRenderBaselineWhileLoading && !this.hasBaselineRevealTimedOut)
    const resolvedData =
      this.options.sdk && this.options.isSdkStateReady
        ? this.options.sdk.resolveOptimizedEntry(
            this.options.baselineEntry,
            this.selectedOptimizations,
          )
        : createBaselineResolvedData(this.options.baselineEntry)
    const metadata: OptimizedEntryMetadata = {
      baselineEntry: this.options.baselineEntry,
      baselineEntryId: this.options.baselineEntry.sys.id,
      entry: resolvedData.entry,
      entryId: resolvedData.entry.sys.id,
      optimizationContextId: resolvedData.optimizationContextId,
      resolvedData,
      selectedOptimization: resolvedData.selectedOptimization,
      selectedOptimizations: this.selectedOptimizations,
    }
    const isResolved = !showLoadingFallback

    return {
      canOptimize: this.canOptimize,
      entry: metadata.entry,
      hostAttributes: showLoadingFallback
        ? {}
        : resolveOptimizedEntryTrackingAttributes(
            this.options.baselineEntry,
            resolvedData,
            this.options,
          ),
      isLoading,
      isPresentationReady: this.options.isPresentationReady,
      isResolved,
      loadingPresentation: {
        showLoadingFallback,
        hideLoadingLayoutTarget,
        shouldRenderBaselineWhileLoading,
        targetDisplay: this.options.targetDisplay,
      },
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

    if (!areSnapshotsEqual(previousSnapshot, nextSnapshot)) {
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
