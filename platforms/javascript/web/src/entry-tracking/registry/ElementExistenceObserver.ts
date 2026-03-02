import { CAN_ADD_LISTENERS, HAS_MUTATION_OBSERVER } from '../../constants'
import { safeCall } from '../../lib'

const isNode = (value: unknown): value is Node =>
  CAN_ADD_LISTENERS && typeof Node !== 'undefined' && value instanceof Node

type AddedCallback = (elements: readonly Element[]) => unknown
type RemovedCallback = (elements: readonly Element[]) => unknown

interface ElementExistenceObserverSubscriber {
  readonly onAdded?: AddedCallback
  readonly onRemoved?: RemovedCallback
  readonly onError?: (error: unknown) => void
}

interface ElementExistenceObserverOptions extends ElementExistenceObserverSubscriber {
  readonly root?: Node
}

function collectElements(
  nodes: ReadonlySet<Node>,
  requireConnected: boolean,
  target: Set<Element>,
): void {
  for (const node of nodes) {
    if (node instanceof Element) {
      if (!requireConnected || node.isConnected) target.add(node)
      node.querySelectorAll('*').forEach((element) => {
        if (!requireConnected || element.isConnected) target.add(element)
      })
      continue
    }

    if (!(node instanceof DocumentFragment)) continue

    node.querySelectorAll('*').forEach((element) => {
      if (!requireConnected || element.isConnected) target.add(element)
    })
  }
}

class ElementExistenceObserver {
  private observer?: MutationObserver
  private readonly root: Node | null
  private readonly subscribers = new Set<ElementExistenceObserverSubscriber>()
  private disconnected = false

  public constructor(options: ElementExistenceObserverOptions = {}) {
    const { root, onAdded, onError, onRemoved } = options
    this.root = isNode(root) ? root : CAN_ADD_LISTENERS ? document : null

    const initialSubscriber = ElementExistenceObserver.toSubscriber({
      onAdded,
      onError,
      onRemoved,
    })

    if (initialSubscriber) {
      this.subscribers.add(initialSubscriber)
    }

    this.ensureObserver()
  }

  public subscribe(subscriber: ElementExistenceObserverSubscriber): () => void {
    if (this.disconnected) return () => undefined

    const normalized = ElementExistenceObserver.toSubscriber(subscriber)
    if (!normalized) return () => undefined

    this.subscribers.add(normalized)
    this.ensureObserver()

    return (): void => {
      this.unsubscribe(normalized)
    }
  }

  public unsubscribe(subscriber: ElementExistenceObserverSubscriber): void {
    this.subscribers.delete(subscriber)
    this.maybeStopObserver()
  }

  public disconnect(): void {
    if (this.disconnected) return

    this.disconnected = true
    this.observer?.disconnect()
    this.observer = undefined
    this.subscribers.clear()
  }

  private ensureObserver(): void {
    if (this.disconnected || this.observer) return
    if (!HAS_MUTATION_OBSERVER || !this.root || this.subscribers.size === 0) return

    this.observer = new MutationObserver((records) => {
      this.processRecords(records)
    })

    this.observer.observe(this.root, {
      childList: true,
      subtree: true,
    })
  }

  private maybeStopObserver(): void {
    if (this.subscribers.size > 0 || !this.observer) return

    this.observer.disconnect()
    this.observer = undefined
  }

  private processRecords(records: readonly MutationRecord[]): void {
    if (records.length === 0 || this.subscribers.size === 0) return

    const addedNodes = new Set<Node>()
    const removedNodes = new Set<Node>()

    for (const record of records) {
      if (record.addedNodes.length > 0) {
        record.addedNodes.forEach((node) => {
          if (removedNodes.delete(node)) return
          addedNodes.add(node)
        })
      }

      if (record.removedNodes.length > 0) {
        record.removedNodes.forEach((node) => {
          if (addedNodes.delete(node)) return
          removedNodes.add(node)
        })
      }
    }

    if (addedNodes.size === 0 && removedNodes.size === 0) return

    const addedElements = new Set<Element>()
    const removedElements = new Set<Element>()
    collectElements(addedNodes, true, addedElements)
    collectElements(removedNodes, false, removedElements)

    if (addedElements.size === 0 && removedElements.size === 0) return

    const added = [...addedElements]
    const removed = [...removedElements]

    this.subscribers.forEach((subscriber) => {
      const { onAdded, onError, onRemoved } = subscriber

      if (removed.length > 0 && onRemoved) {
        safeCall(() => onRemoved(removed), onError)
      }
      if (added.length > 0 && onAdded) {
        safeCall(() => onAdded(added), onError)
      }
    })
  }

  private static toSubscriber(
    subscriber: ElementExistenceObserverSubscriber,
  ): ElementExistenceObserverSubscriber | undefined {
    if (!subscriber.onAdded && !subscriber.onRemoved) {
      return undefined
    }

    return subscriber
  }
}

export default ElementExistenceObserver
