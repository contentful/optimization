import type { ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import {
  OptimizedEntrySourceController,
  type ContentfulEntryQuery,
  type OptimizedEntrySourceSnapshot,
} from '@contentful/optimization-core/entry-source'
import type { Entry, EntrySkeletonType } from 'contentful'
import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  OptimizedEntryController,
  type OptimizedEntryControllerOptions,
  type OptimizedEntrySdk,
  type OptimizedEntrySnapshot,
} from '../presentation'
import {
  ContentfulOptimizationRootElement,
  type ContentfulOptimizationRootContext,
} from './ContentfulOptimizationRootElement'

const ENTRY_LOADING_EVENT = 'ctfl-entry-loading'
const ENTRY_RESOLVED_EVENT = 'ctfl-entry-resolved'
const ENTRY_ERROR_EVENT = 'ctfl-entry-error'

type HostAttributeValue = string | boolean | number | undefined

export interface ContentfulOptimizedEntryEventDetail {
  readonly entry: Entry
  readonly metadata: OptimizedEntrySnapshot['metadata']
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  readonly selectedOptimization: ResolvedData<EntrySkeletonType>['selectedOptimization']
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
  readonly snapshot: OptimizedEntrySnapshot
}

export interface ContentfulOptimizedEntryErrorEventDetail {
  readonly error: Error
}

function parseOptionalBooleanAttribute(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined
  }

  return value !== 'false'
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isHostAttributeVisible(value: HostAttributeValue): value is string | boolean | number {
  return value !== undefined
}

function toAttributeValue(value: string | boolean | number): string {
  return String(value)
}

function hasResolvedDataChanged(
  previous: OptimizedEntrySnapshot | undefined,
  next: OptimizedEntrySnapshot,
): boolean {
  if (previous === undefined) {
    return true
  }

  return (
    previous.entry !== next.entry ||
    previous.selectedOptimization !== next.selectedOptimization ||
    previous.selectedOptimizations !== next.selectedOptimizations
  )
}

export class ContentfulOptimizedEntryElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['entry-id', 'live-updates', 'track-clicks', 'track-hovers', 'track-views']
  }

  private explicitRoot: ContentfulOptimizationRootElement | undefined
  private assignedBaselineEntry: Entry | undefined
  private assignedEntryQuery: ContentfulEntryQuery | undefined
  private controller: OptimizedEntryController | undefined
  private readonly sourceController = new OptimizedEntrySourceController()
  private appliedHostAttributes = new Map<string, string>()
  private previousSnapshot: OptimizedEntrySnapshot | undefined
  private previousSourceSnapshot: OptimizedEntrySourceSnapshot | undefined
  private optimizationRootContext: ContentfulOptimizationRootContext | undefined
  private unsubscribeFromRootContext: (() => void) | undefined
  private assignedSdk: OptimizedEntrySdk | undefined

  get baselineEntry(): Entry | undefined {
    return this.assignedBaselineEntry
  }

  set baselineEntry(value: Entry | undefined) {
    this.assignedBaselineEntry = value
    this.syncEntryController()
  }

  get entryId(): string | undefined {
    return this.getAttribute('entry-id') ?? undefined
  }

  set entryId(value: string | undefined) {
    if (value === undefined) {
      this.removeAttribute('entry-id')
      return
    }

    this.setAttribute('entry-id', value)
  }

  get entryQuery(): ContentfulEntryQuery | undefined {
    return this.assignedEntryQuery
  }

  set entryQuery(value: ContentfulEntryQuery | undefined) {
    this.assignedEntryQuery = value
    this.syncEntryController()
  }

  get sdk(): OptimizedEntrySdk | undefined {
    return this.assignedSdk
  }

  set sdk(value: OptimizedEntrySdk | undefined) {
    this.assignedSdk = value
    this.syncEntryController()
  }

  get root(): ContentfulOptimizationRootElement | undefined {
    return this.explicitRoot
  }

  set root(value: ContentfulOptimizationRootElement | undefined) {
    this.explicitRoot = value
    this.bindRoot()
    this.syncEntryController()
  }

  get liveUpdates(): boolean | undefined {
    return parseOptionalBooleanAttribute(this.getAttribute('live-updates'))
  }

  set liveUpdates(value: boolean | undefined) {
    this.setOptionalBooleanAttribute('live-updates', value)
  }

  get trackClicks(): boolean | undefined {
    return parseOptionalBooleanAttribute(this.getAttribute('track-clicks'))
  }

  set trackClicks(value: boolean | undefined) {
    this.setOptionalBooleanAttribute('track-clicks', value)
  }

  get trackHovers(): boolean | undefined {
    return parseOptionalBooleanAttribute(this.getAttribute('track-hovers'))
  }

  set trackHovers(value: boolean | undefined) {
    this.setOptionalBooleanAttribute('track-hovers', value)
  }

  get trackViews(): boolean | undefined {
    return parseOptionalBooleanAttribute(this.getAttribute('track-views'))
  }

  set trackViews(value: boolean | undefined) {
    this.setOptionalBooleanAttribute('track-views', value)
  }

  connectedCallback(): void {
    this.style.display ||= OPTIMIZED_ENTRY_HOST_DISPLAY

    this.sourceController.setSnapshotListener((snapshot) => {
      this.applySourceSnapshot(snapshot)
    })
    this.bindRoot()
    this.syncEntryController()
  }

  disconnectedCallback(): void {
    this.sourceController.disconnect()
    this.sourceController.setSnapshotListener(undefined)
    this.unsubscribeFromRootContext?.()
    this.unsubscribeFromRootContext = undefined
    this.controller?.disconnect()
    this.controller?.setSnapshotListener(undefined)
    this.controller = undefined
    this.optimizationRootContext = undefined
    this.previousSnapshot = undefined
    this.previousSourceSnapshot = undefined
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) {
      return
    }

    this.syncEntryController()
  }

  private setOptionalBooleanAttribute(name: string, value: boolean | undefined): void {
    if (value === undefined) {
      this.removeAttribute(name)
      return
    }

    this.setAttribute(name, String(value))
  }

  private bindRoot(): void {
    if (!this.isConnected) {
      return
    }

    const nextRoot = this.explicitRoot ?? this.findRoot()

    if (nextRoot === undefined) {
      this.unsubscribeFromRootContext?.()
      this.unsubscribeFromRootContext = undefined
      this.optimizationRootContext = undefined
      return
    }

    this.unsubscribeFromRootContext?.()
    this.unsubscribeFromRootContext = nextRoot.subscribeOptimizationContext((context) => {
      this.optimizationRootContext = context
      this.syncEntryController()
    })
  }

  private findRoot(): ContentfulOptimizationRootElement | undefined {
    let { parentElement: candidate } = this

    while (candidate) {
      if (candidate instanceof ContentfulOptimizationRootElement) {
        return candidate
      }

      const { parentElement } = candidate
      candidate = parentElement
    }

    return undefined
  }

  private syncEntryController(): void {
    const { sdk, isSdkStateReady } = this.resolveControllerSdk()
    const previousSourceSnapshot = this.sourceController.getSnapshot()
    const { entryId } = this

    this.sourceController.updateOptions({
      baselineEntry: this.assignedBaselineEntry,
      entryId: entryId === '' ? undefined : entryId,
      entryQuery: this.assignedEntryQuery,
      sdk,
      isSdkStateReady,
    })

    const nextSourceSnapshot = this.sourceController.getSnapshot()
    this.applySourceSnapshot(nextSourceSnapshot, previousSourceSnapshot === nextSourceSnapshot)
  }

  private syncBaselineEntryController(baselineEntry: Entry): void {
    const { sdk, isSdkStateReady } = this.resolveControllerSdk()

    if (!sdk || !isSdkStateReady) {
      this.clearController()
      this.resetPresentationState()

      if (this.optimizationRootContext?.error) {
        this.dispatchEntryError(this.optimizationRootContext.error)
      }
      return
    }

    try {
      const controllerOptions = this.createControllerOptions(baselineEntry, sdk, isSdkStateReady)
      let { controller } = this
      if (controller === undefined) {
        controller = new OptimizedEntryController(controllerOptions)
        this.controller = controller
        controller.setSnapshotListener((snapshot) => {
          this.applySnapshot(snapshot)
        })
        controller.connect()
      } else {
        controller.updateOptions(controllerOptions)
      }
      this.applySnapshot(controller.getSnapshot())
    } catch (error: unknown) {
      this.dispatchEntryError(toError(error))
    }
  }

  private clearController(): void {
    this.controller?.disconnect()
    this.controller?.setSnapshotListener(undefined)
    this.controller = undefined
  }

  private resolveControllerSdk(): {
    readonly sdk: OptimizedEntrySdk | undefined
    readonly isSdkStateReady: boolean
  } {
    return {
      sdk: this.assignedSdk ?? this.optimizationRootContext?.sdk,
      isSdkStateReady:
        this.assignedSdk !== undefined || this.optimizationRootContext?.isSdkReady === true,
    }
  }

  private applySourceSnapshot(
    snapshot: OptimizedEntrySourceSnapshot,
    forcePresentationUpdate = false,
  ): void {
    const { previousSourceSnapshot } = this
    const sourceSnapshotChanged = previousSourceSnapshot !== snapshot
    this.previousSourceSnapshot = snapshot

    if (snapshot.baselineEntry !== undefined) {
      if (sourceSnapshotChanged || forcePresentationUpdate) {
        this.syncBaselineEntryController(snapshot.baselineEntry)
      }
      return
    }

    this.clearController()
    this.resetPresentationState()
    this.applyManagedSourceSnapshot(snapshot, sourceSnapshotChanged, forcePresentationUpdate)
  }

  private applyManagedSourceSnapshot(
    snapshot: OptimizedEntrySourceSnapshot,
    sourceSnapshotChanged: boolean,
    forcePresentationUpdate: boolean,
  ): void {
    if (snapshot.error !== undefined) {
      if (sourceSnapshotChanged) {
        this.dispatchEntryError(snapshot.error)
      }
      return
    }

    if (snapshot.isLoading && sourceSnapshotChanged) {
      const { sdk, isSdkStateReady } = this.resolveControllerSdk()
      if (sdk !== undefined && isSdkStateReady) {
        this.dispatchEvent(
          new CustomEvent(ENTRY_LOADING_EVENT, {
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    if (forcePresentationUpdate && snapshot.entryId !== undefined) {
      this.dispatchRootContextError()
    }
  }

  private dispatchRootContextError(): void {
    if (this.optimizationRootContext?.error) {
      this.dispatchEntryError(this.optimizationRootContext.error)
    }
  }

  private createControllerOptions(
    baselineEntry: Entry,
    sdk: OptimizedEntrySdk,
    isSdkStateReady: boolean,
  ): OptimizedEntryControllerOptions {
    return {
      isPresentationReady: true,
      hydration: this.optimizationRootContext?.hydration,
      baselineEntry,
      entryLiveUpdatesEnabled: this.liveUpdates,
      rootLiveUpdatesEnabled: this.optimizationRootContext?.rootLiveUpdatesEnabled ?? false,
      hasCustomLoadingFallback: false,
      isPreviewPanelOpen: this.optimizationRootContext?.isPreviewPanelOpen ?? false,
      sdk,
      isSdkStateReady,
      targetDisplay: 'block',
      trackClicks: this.trackClicks,
      trackHovers: this.trackHovers,
      trackViews: this.trackViews,
    }
  }

  private applySnapshot(snapshot: OptimizedEntrySnapshot): void {
    const { previousSnapshot } = this
    this.applyHostAttributes(snapshot.hostAttributes)
    this.applyLoadingVisibility(snapshot)

    if (snapshot.loadingPresentation.showLoadingFallback) {
      if (previousSnapshot?.loadingPresentation.showLoadingFallback !== true) {
        this.dispatchEntryEvent(ENTRY_LOADING_EVENT, snapshot)
      }
    } else if (
      previousSnapshot?.loadingPresentation.showLoadingFallback === true ||
      hasResolvedDataChanged(previousSnapshot, snapshot)
    ) {
      this.dispatchEntryEvent(ENTRY_RESOLVED_EVENT, snapshot)
    }

    this.previousSnapshot = snapshot
  }

  private applyHostAttributes(attributes: Record<string, HostAttributeValue>): void {
    const nextAttributes = new Map<string, string>()

    Object.entries(attributes).forEach(([name, value]) => {
      if (isHostAttributeVisible(value)) {
        nextAttributes.set(name, toAttributeValue(value))
      }
    })

    this.appliedHostAttributes.forEach((_value, name) => {
      if (!nextAttributes.has(name)) {
        this.removeAttribute(name)
      }
    })

    nextAttributes.forEach((value, name) => {
      if (this.appliedHostAttributes.get(name) !== value) {
        this.setAttribute(name, value)
      }
    })

    this.appliedHostAttributes = nextAttributes
  }

  private resetPresentationState(): void {
    this.applyHostAttributes({})
    this.style.removeProperty('visibility')
    this.previousSnapshot = undefined
  }

  private applyLoadingVisibility(snapshot: OptimizedEntrySnapshot): void {
    if (
      snapshot.loadingPresentation.showLoadingFallback &&
      snapshot.loadingPresentation.hideLoadingLayoutTarget
    ) {
      this.style.visibility = 'hidden'
      return
    }

    this.style.removeProperty('visibility')
  }

  private dispatchEntryEvent(type: string, snapshot: OptimizedEntrySnapshot): void {
    this.dispatchEvent(
      new CustomEvent<ContentfulOptimizedEntryEventDetail>(type, {
        bubbles: true,
        composed: true,
        detail: {
          entry: snapshot.entry,
          metadata: snapshot.metadata,
          resolvedData: snapshot.resolvedData,
          selectedOptimization: snapshot.selectedOptimization,
          selectedOptimizations: snapshot.selectedOptimizations,
          snapshot,
        },
      }),
    )
  }

  private dispatchEntryError(error: Error): void {
    this.dispatchEvent(
      new CustomEvent<ContentfulOptimizedEntryErrorEventDetail>(ENTRY_ERROR_EVENT, {
        bubbles: true,
        composed: true,
        detail: { error },
      }),
    )
  }
}
