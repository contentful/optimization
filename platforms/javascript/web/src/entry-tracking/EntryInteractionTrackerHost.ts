import type { EntryElementRegistry } from './registry/EntryElementRegistry'
import type { EntryElement } from './resolveComponentTrackingPayload'

/**
 * Detector contract implemented by concrete entry interaction strategies.
 *
 * @typeParam TStartOptions - Options passed when auto-tracking is started.
 * @typeParam TElementOptions - Options passed when manually tracking an element.
 *
 * @public
 */
export interface EntryInteractionDetector<TStartOptions = never, TElementOptions = never> {
  start: (options?: TStartOptions) => void
  stop: () => void
  onEntryAdded?: (entryElement: EntryElement) => void
  onEntryRemoved?: (entryElement: EntryElement) => void
  onError?: (error: unknown) => void
  trackElement?: (element: Element, options: TElementOptions) => void
  untrackElement?: (element: Element) => void
}

/**
 * Generic host that wires one interaction detector to the shared entry registry.
 *
 * @internal
 */
export class EntryInteractionTrackerHost<TStartOptions = never, TElementOptions = never> {
  private readonly detector: EntryInteractionDetector<TStartOptions, TElementOptions>
  private readonly entryElementRegistry: EntryElementRegistry
  private cleanupRegistrySubscription?: () => void

  public constructor(
    detector: EntryInteractionDetector<TStartOptions, TElementOptions>,
    entryElementRegistry: EntryElementRegistry,
  ) {
    this.detector = detector
    this.entryElementRegistry = entryElementRegistry
  }

  public start(options?: TStartOptions): void {
    this.detector.start(options)
    this.cleanupRegistrySubscription = this.entryElementRegistry.subscribe({
      onAdded: this.detector.onEntryAdded,
      onRemoved: this.detector.onEntryRemoved,
      onError: this.detector.onError,
    })
  }

  public stop(): void {
    this.cleanupRegistrySubscription?.()
    this.cleanupRegistrySubscription = undefined
    this.detector.stop()
  }

  public trackElement(element: Element, options: TElementOptions): void {
    this.detector.trackElement?.(element, options)
  }

  public untrackElement(element: Element): void {
    this.detector.untrackElement?.(element)
  }
}
