/**
 * ElementExistenceObserver
 * - Observes childList + subtree
 * - Coalesces moves (reparent/reorder ignored)
 * - Filters to Element (for IntersectionObserver)
 * - Batches & chunks delivery in idle time
 * - Two optional per-kind callbacks + one aggregate callback
 */

import {
  CAN_ADD_LISTENERS,
  HAS_CANCEL_IDLE,
  HAS_IDLE_CALLBACK,
  HAS_MUTATION_OBSERVER,
} from '../../constants'
import { safeCall } from '../../lib'

const isNode = (value: unknown): value is Node =>
  CAN_ADD_LISTENERS && typeof Node !== 'undefined' && value instanceof Node

const scheduleIdle = (run: () => void, timeoutMs: number): number =>
  HAS_IDLE_CALLBACK
    ? window.requestIdleCallback(run, { timeout: timeoutMs })
    : window.setTimeout(run, timeoutMs)

const cancelIdle = (handle: number): void => {
  if (HAS_CANCEL_IDLE) {
    window.cancelIdleCallback(handle)
    return
  }

  if (CAN_ADD_LISTENERS) {
    window.clearTimeout(handle)
  }
}

/**
 * Default idle timeout (in milliseconds) used when scheduling processing
 * of mutation records.
 *
 * @public
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 100

/**
 * Default maximum number of elements delivered in a single callback chunk.
 *
 * @public
 */
const DEFAULT_MAX_CHUNK = 250

/**
 * Lower bound for idle timeout to avoid ultra-tight loops (~1 animation frame).
 *
 * @public
 */
export const MIN_IDLE_TIMEOUT_MS = 16 // ~1 frame

/**
 * Lower bound for maximum chunk size (must deliver at least one element).
 *
 * @public
 */
const MIN_MAX_CHUNK = 1

/**
 * Aggregate description of changes observed in a batch of mutation records.
 *
 * @public
 */
interface MutationChange {
  /** Set of elements that were added. */
  readonly added: ReadonlySet<Element>
  /** Set of elements that were removed. */
  readonly removed: ReadonlySet<Element>
  /** Raw mutation records that produced this change. */
  readonly records: readonly MutationRecord[]
}

/**
 * Callback invoked when elements have been added.
 *
 * @public
 */
type AddedCallback = (elements: readonly Element[]) => unknown

/**
 * Callback invoked when elements have been removed.
 *
 * @public
 */
type RemovedCallback = (elements: readonly Element[]) => unknown

/**
 * Callback invoked when a batch of mutation records has been coalesced.
 *
 * @public
 */
type MutationChangeCallback = (change: MutationChange) => unknown

/**
 * Subscriber callbacks for {@link ElementExistenceObserver}.
 *
 * @public
 */
interface ElementExistenceObserverSubscriber {
  /**
   * Callback invoked with the aggregate change payload (added/removed plus raw records).
   */
  readonly onChange?: MutationChangeCallback
  /**
   * Callback invoked with per-kind additions (batched/chunked).
   */
  readonly onAdded?: AddedCallback
  /**
   * Callback invoked with per-kind removals (batched/chunked).
   */
  readonly onRemoved?: RemovedCallback
  /**
   * Optional error handler for callback failures.
   */
  readonly onError?: (error: unknown) => void
}

/**
 * Options for configuring {@link ElementExistenceObserver}.
 *
 * @public
 */
interface ElementExistenceObserverOptions extends ElementExistenceObserverSubscriber {
  /**
   * Root node to observe for changes. Defaults to `document` where possible.
   */
  readonly root?: Node
  /**
   * Idle timeout in milliseconds used when scheduling processing of mutations.
   */
  readonly idleTimeoutMs?: number
  /**
   * Maximum number of elements delivered per callback chunk.
   */
  readonly maxChunk?: number
}

/**
 * Observe the existence of elements under a root node and deliver coalesced
 * add/remove notifications in idle time.
 *
 * @remarks
 * In non-DOM / SSR environments, the observer becomes a safe no-op, and
 * mutation handling is disabled.
 *
 * @see {@link ElementExistenceObserverOptions}
 *
 * @public
 */
class ElementExistenceObserver {
  private observer?: MutationObserver

  private readonly root: Node | null
  private readonly idleTimeoutMs: number
  private readonly maxChunk: number

  private readonly subscribers = new Set<ElementExistenceObserverSubscriber>()

  private pendingRecords: MutationRecord[] = []
  private scheduled = false
  private idleHandle: number | null = null
  private disconnected = false

  /**
   * Create a new element existence observer.
   *
   * @param options - Optional configuration for root, callbacks, and batching.
   *
   * @example
   * ```ts
   * const observer = new ElementExistenceObserver({
   *   onAdded: (elements) => console.log('added', elements),
   *   onRemoved: (elements) => console.log('removed', elements),
   * })
   * ```
   */
  public constructor(options: ElementExistenceObserverOptions = {}) {
    const {
      root,
      idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
      maxChunk = DEFAULT_MAX_CHUNK,
      onAdded,
      onChange,
      onError,
      onRemoved,
    } = options

    this.root = isNode(root) ? root : CAN_ADD_LISTENERS ? document : null

    this.idleTimeoutMs = ElementExistenceObserver.sanitizeInt(
      idleTimeoutMs,
      DEFAULT_IDLE_TIMEOUT_MS,
      MIN_IDLE_TIMEOUT_MS,
    )
    this.maxChunk = ElementExistenceObserver.sanitizeInt(maxChunk, DEFAULT_MAX_CHUNK, MIN_MAX_CHUNK)

    const initialSubscriber = ElementExistenceObserver.toSubscriber({
      onAdded,
      onChange,
      onError,
      onRemoved,
    })

    if (initialSubscriber) {
      this.subscribers.add(initialSubscriber)
    }

    this.ensureObserver()
  }

  /**
   * Subscribe to coalesced mutation events.
   *
   * @param subscriber - Callback collection to receive mutation updates.
   * @returns Cleanup function that removes this subscription.
   */
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

  /**
   * Remove an existing subscription.
   *
   * @param subscriber - Subscriber to remove.
   */
  public unsubscribe(subscriber: ElementExistenceObserverSubscriber): void {
    this.subscribers.delete(subscriber)
    this.maybeStopObserver()
  }

  /**
   * True if the watcher is actively observing (i.e., in a browser with MutationObserver).
   *
   * @returns `true` when observing, `false` when disconnected or in a non-DOM environment.
   *
   * @example
   * ```ts
   * if (observer.isActive()) { /* ... *\/ }
   * ```
   */
  public isActive(): boolean {
    return !!this.observer && !this.disconnected
  }

  /**
   * Stop observing and clear any pending work.
   *
   * @returns Nothing.
   *
   * @example
   * ```ts
   * observer.disconnect()
   * ```
   */
  public disconnect(): void {
    if (this.disconnected) return
    this.disconnected = true

    this.observer?.disconnect()
    this.observer = undefined
    this.subscribers.clear()
    this.pendingRecords = []

    if (this.idleHandle !== null) {
      cancelIdle(this.idleHandle)
      this.idleHandle = null
    }
    this.scheduled = false
  }

  /**
   * Synchronously process any pending mutation records.
   *
   * @returns Nothing.
   *
   * @remarks
   * Cancels any outstanding idle callbacks or timeouts and delivers changes immediately.
   *
   * @example
   * ```ts
   * observer.flush()
   * ```
   */
  public flush(): void {
    this.ensureObserver()
    if (!this.isActive()) return

    if (this.idleHandle !== null) {
      cancelIdle(this.idleHandle)
      this.idleHandle = null
    }
    if (!this.scheduled && this.pendingRecords.length === 0) return

    this.scheduled = false
    this.processNow()
  }

  /**
   * Start observing mutations when supported and at least one subscriber exists.
   *
   * @internal
   */
  private ensureObserver(): void {
    if (this.disconnected || this.observer) return
    if (!HAS_MUTATION_OBSERVER || !this.root || this.subscribers.size === 0) return

    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.addedNodes.length > 0 || record.removedNodes.length > 0) {
          this.pendingRecords.push(record)
        }
      }
      if (this.pendingRecords.length > 0) this.scheduleProcess()
    })

    this.observer.observe(this.root, {
      childList: true,
      subtree: true,
    })
  }

  /**
   * Stop observing and clear queued work when no subscribers remain.
   *
   * @internal
   */
  private maybeStopObserver(): void {
    if (this.subscribers.size > 0 || !this.observer) return

    this.observer.disconnect()
    this.observer = undefined
    this.pendingRecords = []

    if (this.idleHandle !== null) {
      cancelIdle(this.idleHandle)
      this.idleHandle = null
    }
    this.scheduled = false
  }

  /**
   * Schedule processing of pending records using idle time or a timeout.
   *
   * @internal
   */
  private scheduleProcess(): void {
    if (!this.isActive() || this.scheduled) return
    this.scheduled = true

    const run = (): void => {
      this.idleHandle = null
      this.scheduled = false
      this.processNow()
    }

    this.idleHandle = scheduleIdle(run, this.idleTimeoutMs)
  }

  /**
   * Process all currently pending mutation records immediately.
   *
   * @internal
   */
  private processNow(): void {
    if (!this.isActive() || this.pendingRecords.length === 0) return

    const records = this.drainPending()
    const { addedNodes, removedNodes } = ElementExistenceObserver.coalesce(records)
    const { added, removed } = ElementExistenceObserver.toElementSets(addedNodes, removedNodes)

    if (added.size === 0 && removed.size === 0) return

    this.deliverAggregate(added, removed, records)
    this.deliverPerKind(removed, added) // removals first, then additions
  }

  /**
   * Normalize and validate subscriber callback collection.
   *
   * @internal
   */
  private static toSubscriber(
    subscriber: ElementExistenceObserverSubscriber,
  ): ElementExistenceObserverSubscriber | undefined {
    if (
      !subscriber.onAdded &&
      !subscriber.onChange &&
      !subscriber.onError &&
      !subscriber.onRemoved
    ) {
      return undefined
    }

    return subscriber
  }

  /**
   * Normalize a numeric option to a finite integer and enforce a minimum.
   *
   * @internal
   */
  private static sanitizeInt(value: unknown, fallback: number, min: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    const truncated = Math.trunc(value)
    return truncated >= min ? truncated : min
  }

  /**
   * Coalesce a set of mutation records into net added and removed nodes,
   * ignoring transient moves.
   *
   * @internal
   */
  private static coalesce(records: readonly MutationRecord[]): {
    addedNodes: Set<Node>
    removedNodes: Set<Node>
  } {
    const addedNodes = new Set<Node>()
    const removedNodes = new Set<Node>()

    for (const record of records) {
      for (const node of record.addedNodes) {
        if (removedNodes.delete(node)) continue // move
        addedNodes.add(node)
      }
      for (const node of record.removedNodes) {
        if (addedNodes.delete(node)) continue // move
        removedNodes.add(node)
      }
    }
    return { addedNodes, removedNodes }
  }

  /**
   * Convert node-level sets into element-only sets, including descendants.
   *
   * @internal
   */
  private static toElementSets(
    addedNodes: ReadonlySet<Node>,
    removedNodes: ReadonlySet<Node>,
  ): { added: Set<Element>; removed: Set<Element> } {
    const added = ElementExistenceObserver.flattenElements(addedNodes, true)
    const removed = ElementExistenceObserver.flattenElements(removedNodes, false)
    return { added, removed }
  }

  /**
   * Collect all elements (and descendants) from a set of nodes, optionally
   * filtering out disconnected nodes.
   *
   * @internal
   */
  private static flattenElements(
    nodes: ReadonlySet<Node>,
    requireConnected: boolean,
  ): Set<Element> {
    const out = new Set<Element>()

    for (const node of nodes) {
      if (node instanceof Element) {
        if (!requireConnected || node.isConnected) out.add(node)
        node.querySelectorAll('*').forEach((el) => {
          if (!requireConnected || el.isConnected) out.add(el)
        })
        continue
      }

      if (node instanceof DocumentFragment) {
        node.querySelectorAll('*').forEach((el) => {
          if (!requireConnected || el.isConnected) out.add(el)
        })
      }
    }

    return out
  }

  /**
   * Drain and return the current list of pending mutation records.
   *
   * @internal
   */
  private drainPending(): MutationRecord[] {
    const { pendingRecords: out } = this
    this.pendingRecords = []
    return out
  }

  /**
   * Deliver the aggregate change payload (added, removed, records) to the
   * `onChange` callback if configured.
   *
   * @internal
   */
  private deliverAggregate(
    added: ReadonlySet<Element>,
    removed: ReadonlySet<Element>,
    records: readonly MutationRecord[],
  ): void {
    if (this.subscribers.size === 0) return
    const payload: MutationChange = { added, removed, records }

    for (const subscriber of this.subscribers) {
      const { onChange, onError } = subscriber

      if (!onChange) continue

      safeCall(() => onChange(payload), onError)
    }
  }

  /**
   * Deliver per-kind added/removed elements to their respective callbacks in
   * chunks if necessary.
   *
   * @internal
   */
  private deliverPerKind(removed: ReadonlySet<Element>, added: ReadonlySet<Element>): void {
    if (this.subscribers.size === 0) return

    const removedArr = removed.size > 0 ? [...removed] : []
    const addedArr = added.size > 0 ? [...added] : []

    for (const subscriber of this.subscribers) {
      const { onAdded, onError, onRemoved } = subscriber

      if (onRemoved && removedArr.length > 0) {
        this.dispatchChunked(removedArr, onRemoved, onError)
      }
      if (onAdded && addedArr.length > 0) {
        this.dispatchChunked(addedArr, onAdded, onError)
      }
    }
  }

  /**
   * Dispatch element arrays in chunks to respect the configured `maxChunk`
   * and avoid blocking the main thread.
   *
   * @internal
   */
  private dispatchChunked(
    items: readonly Element[],
    fn: (chunk: readonly Element[]) => unknown,
    onError?: (error: unknown) => void,
  ): void {
    if (!this.isActive() || items.length === 0) return

    if (items.length <= this.maxChunk) {
      safeCall(() => fn(items), onError)
      return
    }

    let index = 0
    const run = (): void => {
      if (!this.isActive()) return
      const end = Math.min(items.length, index + this.maxChunk)
      const chunk = items.slice(index, end)
      index = end

      safeCall(() => fn(chunk), onError)

      if (index < items.length) scheduleIdle(run, this.idleTimeoutMs)
    }

    run()
  }
}

export default ElementExistenceObserver
