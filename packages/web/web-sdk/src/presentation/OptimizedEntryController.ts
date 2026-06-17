import type { Observable, ResolvedData, Subscription } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'

const BASELINE_REVEAL_TIMEOUT_MS = 5000

type HostAttributeValue = string | boolean | number | undefined
export type OptimizedEntryLoadingTargetDisplay = 'block' | 'inline'

export const OPTIMIZED_ENTRY_HOST_DISPLAY = 'contents'

interface ExperienceRequestStateLike {
  readonly status: string
}

interface SelectedOptimizationWithDuplicationScope {
  readonly duplicationScope?: unknown
  readonly experienceId?: string
  readonly sticky?: boolean
  readonly variantIndex?: number
}

export interface OptimizedEntrySdk {
  readonly states: {
    readonly canOptimize: Observable<boolean>
    readonly experienceRequestState: Observable<ExperienceRequestStateLike>
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
  readonly hostAttributes: Record<string, HostAttributeValue>
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

function resolveDuplicationScope(
  selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization'],
): string | undefined {
  const candidate = (selectedOptimization as SelectedOptimizationWithDuplicationScope | undefined)
    ?.duplicationScope

  if (typeof candidate !== 'string') {
    return undefined
  }

  return candidate.trim() ? candidate : undefined
}

function resolveTrackingAttributes(
  baselineEntry: Entry,
  resolvedData: ResolvedData<EntrySkeletonType>,
  options: Pick<
    NormalizedOptimizedEntryControllerOptions,
    | 'clickable'
    | 'hoverDurationUpdateIntervalMs'
    | 'trackClicks'
    | 'trackHovers'
    | 'trackViews'
    | 'viewDurationUpdateIntervalMs'
  >,
): Record<string, HostAttributeValue> {
  const {
    selectedOptimization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData
  const {
    clickable,
    hoverDurationUpdateIntervalMs,
    trackClicks,
    trackHovers,
    trackViews,
    viewDurationUpdateIntervalMs,
  } = options

  return {
    'data-ctfl-baseline-id': baselineEntry.sys.id,
    'data-ctfl-clickable': clickable === true ? true : undefined,
    'data-ctfl-duplication-scope': resolveDuplicationScope(selectedOptimization),
    'data-ctfl-entry-id': entryId,
    'data-ctfl-hover-duration-update-interval-ms': hoverDurationUpdateIntervalMs,
    'data-ctfl-optimization-id': selectedOptimization?.experienceId,
    'data-ctfl-sticky': selectedOptimization?.sticky,
    'data-ctfl-track-clicks': trackClicks,
    'data-ctfl-track-hovers': trackHovers,
    'data-ctfl-track-views': trackViews,
    'data-ctfl-variant-index': selectedOptimization?.variantIndex ?? 0,
    'data-ctfl-view-duration-update-interval-ms': viewDurationUpdateIntervalMs,
  }
}

function createBaselineResolvedData(entry: Entry): ResolvedData<EntrySkeletonType> {
  return { entry, selectedOptimization: undefined }
}

function isExperienceRequestSettled(state: ExperienceRequestStateLike): boolean {
  return state.status === 'success' || state.status === 'failed'
}

function areHostAttributesEqual(
  left: Record<string, HostAttributeValue>,
  right: Record<string, HostAttributeValue>,
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
  private listener: OptimizedEntrySnapshotListener | undefined = undefined
  private baselineRevealTimeout: ReturnType<typeof setTimeout> | undefined = undefined
  private options: NormalizedOptimizedEntryControllerOptions
  private hasBaselineRevealTimedOut = false
  private selectedOptimizations: SelectedOptimizationArray | undefined = undefined
  private snapshot: OptimizedEntrySnapshot
  private subscriptions: Subscription[] = []

  constructor(options: OptimizedEntryControllerOptions) {
    this.options = normalizeOptions(options)
    this.snapshot = this.createSnapshot()
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

    this.subscriptions = [
      sdk.states.selectedOptimizations.subscribe((selectedOptimizations) => {
        if (this.shouldLiveUpdate()) {
          this.selectedOptimizations = selectedOptimizations
          this.updateSnapshot()
          return
        }

        if (this.selectedOptimizations === undefined && selectedOptimizations !== undefined) {
          this.selectedOptimizations = selectedOptimizations
          this.updateSnapshot()
        }
      }),
      sdk.states.canOptimize.subscribe((canOptimize) => {
        this.canOptimize = canOptimize
        this.updateSnapshot()
      }),
      sdk.states.experienceRequestState.subscribe((state) => {
        this.hasExperienceRequestSettled = isExperienceRequestSettled(state)
        this.updateSnapshot()
      }),
    ]
  }

  private resolveIsLoading(): boolean {
    const requiresOptimization = hasOptimizationReferences(this.options.baselineEntry)
    const isContentReady = !requiresOptimization || this.hasExperienceRequestSettled

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
        : resolveTrackingAttributes(this.options.baselineEntry, resolvedData, this.options),
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
