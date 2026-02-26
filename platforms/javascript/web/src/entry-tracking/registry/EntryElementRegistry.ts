import { ENTRY_SELECTOR } from '../../global-constants'
import { safeCall } from '../../lib'
import { isEntryElement, type EntryElement } from '../resolveComponentTrackingPayload'
import type ElementExistenceObserver from './ElementExistenceObserver'

/**
 * Subscriber callbacks for entry element lifecycle notifications.
 *
 * @internal
 */
interface EntryElementRegistrySubscriber {
  readonly onAdded?: (entryElement: EntryElement) => void
  readonly onRemoved?: (entryElement: EntryElement) => void
  readonly onError?: (error: unknown) => void
}

/**
 * Registry that tracks entry elements currently present in the DOM and
 * notifies subscribers as entries are added or removed.
 *
 * @public
 */
export class EntryElementRegistry {
  private readonly elementExistenceObserver: ElementExistenceObserver
  private readonly entries = new Set<EntryElement>()
  private readonly subscribers = new Set<EntryElementRegistrySubscriber>()
  private cleanupExistenceSubscription?: () => void

  public constructor(elementExistenceObserver: ElementExistenceObserver) {
    this.elementExistenceObserver = elementExistenceObserver
  }

  public subscribe(subscriber: EntryElementRegistrySubscriber): () => void {
    this.start()

    this.subscribers.add(subscriber)
    this.entries.forEach((entryElement) => {
      EntryElementRegistry.notifyAdded(subscriber, entryElement)
    })

    return () => {
      this.subscribers.delete(subscriber)

      if (this.subscribers.size > 0) return

      this.stop()
    }
  }

  public disconnect(): void {
    this.subscribers.clear()
    this.stop()
  }

  private start(): void {
    if (this.cleanupExistenceSubscription) return

    this.cleanupExistenceSubscription = this.elementExistenceObserver.subscribe({
      onAdded: (elements): void => {
        this.onElementsAdded(elements)
      },
      onRemoved: (elements): void => {
        this.onElementsRemoved(elements)
      },
    })

    this.seedInitialEntries()
  }

  private stop(): void {
    this.cleanupExistenceSubscription?.()
    this.cleanupExistenceSubscription = undefined
    this.entries.clear()
  }

  private onEntryAdded(entryElement: EntryElement): void {
    if (this.entries.has(entryElement)) return

    this.entries.add(entryElement)

    this.subscribers.forEach((subscriber) => {
      EntryElementRegistry.notifyAdded(subscriber, entryElement)
    })
  }

  private onEntryRemoved(entryElement: EntryElement): void {
    if (!this.entries.delete(entryElement)) return

    this.subscribers.forEach((subscriber) => {
      EntryElementRegistry.notifyRemoved(subscriber, entryElement)
    })
  }

  private onElementsAdded(elements: readonly Element[]): void {
    elements.forEach((element) => {
      const entryElement = EntryElementRegistry.resolveEntryElementFromMutation(element)
      if (!entryElement) return
      this.onEntryAdded(entryElement)
    })
  }

  private onElementsRemoved(elements: readonly Element[]): void {
    elements.forEach((element) => {
      const entryElement = EntryElementRegistry.resolveEntryElementFromMutation(element)
      if (!entryElement) return
      this.onEntryRemoved(entryElement)
    })
  }

  private seedInitialEntries(): void {
    if (typeof document === 'undefined') return

    document.querySelectorAll(ENTRY_SELECTOR).forEach((element) => {
      if (!isEntryElement(element)) return

      this.onEntryAdded(element)
    })
  }

  private static resolveEntryElementFromMutation(element: Element): EntryElement | undefined {
    if (isEntryElement(element)) return element

    const nestedEntry = element.querySelector(ENTRY_SELECTOR) ?? undefined

    return isEntryElement(nestedEntry) ? nestedEntry : undefined
  }

  private static notifyAdded(
    subscriber: EntryElementRegistrySubscriber,
    entryElement: EntryElement,
  ): void {
    if (!subscriber.onAdded) return

    safeCall(() => subscriber.onAdded?.(entryElement), subscriber.onError)
  }

  private static notifyRemoved(
    subscriber: EntryElementRegistrySubscriber,
    entryElement: EntryElement,
  ): void {
    if (!subscriber.onRemoved) return

    safeCall(() => subscriber.onRemoved?.(entryElement), subscriber.onError)
  }
}
