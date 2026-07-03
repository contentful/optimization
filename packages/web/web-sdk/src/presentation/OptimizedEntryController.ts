import type { Observable, ResolvedData, Subscription } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import {
  resolveOptimizedEntryTrackingAttributes,
  type OptimizedEntryTrackingAttributes,
} from './OptimizedEntryTrackingAttributes'

const BASELINE_REVEAL_TIMEOUT_MS = 5000

export type OptimizedEntryLoadingTargetDisplay = 'block' | 'inline'

export const OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'

interface ExperienceRequestStateLike {
  readonly status: string
}

export interface OptimizedEntrySdk {
  readonly states: {
    readonly canOptimize: Observable<boolean>
    readonly experienceRequestState: Observable<ExperienceRequestStateLike>
    readonly optimizationPossible: Observable<boolean>
    readonly selectedOptimizations: Observable<SelectedOptimizationArray | undefined>
  }
  resolveOptimizedEntry: (
    entry: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ) => ResolvedData<EntrySkeletonType>
}

export interface OptimizedEntrySnapshot {
  readonly canOptimize: boolean
  readonly entry: Entry
  readonly hostAttributes: OptimizedEntryTrackingAttributes
  readonly isLoading: boolean
  readonly isReady: boolean
  readonly loadingPresentation: {
    readonly showLoadingFallback: boolean
    readonly hideLoadingLayoutTarget: boolean
    readonly shouldRenderBaselineWhileLoading: boolean
    readonly targetDisplay: OptimizedEntryLoadingTargetDisplay
  }
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  readonly selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}

export interface OptimizedEntryControllerOptions {
  readonly isPresentationReady?: boolean
  readonly baselineEntry: Entry
  readonly entryLiveUpdatesEnabled?: boolean
  readonly rootLiveUpdatesEnabled?: boolean
  readonly hasCustomLoadingFallback?: boolean
  readonly baselineRevealTimeoutMs?: number
  readonly isPreviewPanelOpen?: boolean
  readonly sdk?: OptimizedEntrySdk
  readonly isSdkStateReady?: boolean
  readonly targetDisplay?: OptimizedEntryLoadingTargetDisplay
  readonly clickable?: boolean
  readonly hoverDurationUpdateIntervalMs?: number
  readonly trackClicks?: boolean
  readonly trackHovers?: boolean
  readonly trackViews?: boolean
  readonly viewDurationUpdateIntervalMs?: number
}

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

export interface OptimizedEntryNestingState {
  readonly currentAndAncestorBaselineIds: ReadonlySet<string>
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

export function hasOptimizationReferences(entry: Entry): boolean {
  return Array.isArray(entry.fields.nt_experiences) && entry.fields.nt_experiences.length > 0
}

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

function areSnapshotsEqual(left: OptimizedEntrySnapshot, right: OptimizedEntrySnapshot): boolean {
  return (
    left.canOptimize === right.canOptimize &&
    left.entry === right.entry &&
    left.isLoading === right.isLoading &&
    left.isReady === right.isReady &&
    left.selectedOptimization === right.selectedOptimization &&
    left.selectedOptimizations === right.selectedOptimizations &&
    areLoadingPresentationsEqual(left.loadingPresentation, right.loadingPresentation) &&
    areHostAttributesEqual(left.hostAttributes, right.hostAttributes)
  )
}

export class OptimizedEntryController {
  private canOptimize = false
  private connected = false
  private hasExperienceRequestSettled = false
  private optimizationPossible = true
  private listener: OptimizedEntrySnapshotListener | undefined = undefined
  private baselineRevealTimeout: ReturnType<typeof setTimeout> | undefined = undefined
  private options: NormalizedOptimizedEntryControllerOptions
  private hasBaselineRevealTimedOut = false
  private selectedOptimizations: SelectedOptimizationArray | undefined = undefined
  private snapshot: OptimizedEntrySnapshot
  private subscriptions: Subscription[] = []

  constructor(options: OptimizedEntryControllerOptions) {
    this.options = normalizeOptions(options)
    // Prime from the SDK state's current values so the initial snapshot resolves
    // the selected variant during server rendering and the first client render,
    // before connect() attaches live subscriptions.
    this.primeStateFromSdk()
    this.snapshot = this.createSnapshot()
  }

  /**
   * Read the current SDK state values into local fields without subscribing.
   *
   * @remarks
   * Used at construction (so the first snapshot resolves the variant, including
   * during SSR where {@link OptimizedEntryController.connect} never runs) and at
   * the start of {@link OptimizedEntryController.resubscribe}.
   */
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

  setSnapshotListener(listener: OptimizedEntrySnapshotListener | undefined): void {
    this.listener = listener
  }

  connect(): void {
    if (this.connected) {
      return
    }

    this.connected = true
    this.resubscribe()
    this.updateSnapshot()
  }

  disconnect(): void {
    this.connected = false
    this.clearSubscriptions()
    this.clearLoadingRevealTimer()
  }

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

    return {
      canOptimize: this.canOptimize,
      entry: resolvedData.entry,
      hostAttributes: showLoadingFallback
        ? {}
        : resolveOptimizedEntryTrackingAttributes(
            this.options.baselineEntry,
            resolvedData,
            this.options,
          ),
      isLoading,
      isReady: this.options.isPresentationReady,
      loadingPresentation: {
        showLoadingFallback,
        hideLoadingLayoutTarget,
        shouldRenderBaselineWhileLoading,
        targetDisplay: this.options.targetDisplay,
      },
      resolvedData,
      selectedOptimization: resolvedData.selectedOptimization,
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
