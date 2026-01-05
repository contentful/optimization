/**
 * ElementExistenceObserver
 * - Observes childList + subtree
 * - Coalesces moves (reparent/reorder ignored)
 * - Filters to Element (for IntersectionObserver)
 * - Batches & chunks delivery in idle time
 * - Two optional per-kind callbacks + one aggregate callback
 */

import { CAN_ADD_LISTENERS } from '../global-constants'

/**
 * Default idle timeout (in milliseconds) used when scheduling processing
 * of mutation records.
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 100

/**
 * Default maximum number of elements delivered in a single callback chunk.
 */
export const DEFAULT_MAX_CHUNK = 250

/**
 * Lower bound for idle timeout to avoid ultra-tight loops (~1 animation frame).
 */
export const MIN_IDLE_TIMEOUT_MS = 16 // ~1 frame

/**
 * Lower bound for maximum chunk size (must deliver at least one element).
 */
export const MIN_MAX_CHUNK = 1

/**
 * True when the environment supports `MutationObserver` and can add listeners.
 */
export const HAS_MUTATION_OBSERVER = CAN_ADD_LISTENERS && typeof MutationObserver !== 'undefined'

/**
 * True when the environment supports `window.requestIdleCallback`.
 */
export const HAS_IDLE_CALLBACK =
  CAN_ADD_LISTENERS && typeof window.requestIdleCallback === 'function'

/**
 * True when the environment supports `window.cancelIdleCallback`.
 */
export const HAS_CANCEL_IDLE = CAN_ADD_LISTENERS && typeof window.cancelIdleCallback === 'function'

/**
 * Aggregate description of changes observed in a batch of mutation records.
 */
export interface MutationChange {
  /** Set of elements that were added. */
  readonly added: ReadonlySet<Element>
  /** Set of elements that were removed. */
  readonly removed: ReadonlySet<Element>
  /** Raw mutation records that produced this change. */
  readonly records: readonly MutationRecord[]
}

/**
 * Callback invoked when elements have been added.
 */
export type AddedCallback = (elements: readonly Element[]) => unknown

/**
 * Callback invoked when elements have been removed.
 */
export type RemovedCallback = (elements: readonly Element[]) => unknown

/**
 * Callback invoked when a batch of mutation records has been coalesced.
 */
export type MutationChangeCallback = (change: MutationChange) => unknown

/**
 * Options for configuring {@link ElementExistenceObserver}.
 */
export interface ElementExistenceObserverOptions {
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
 * Observe the existence of elements under a root node and deliver coalesced
 * add/remove notifications in idle time.
 *
 * @remarks
 * In non-DOM / SSR environments, the observer becomes a safe no-op, and
 * mutation handling is disabled.
 */
class ElementExistenceObserver {
  private readonly observer?: MutationObserver

  private readonly root: Node | null
  private readonly idleTimeoutMs: number
  private readonly maxChunk: number

  private readonly onChange?: MutationChangeCallback
  private readonly onAdded?: AddedCallback
  private readonly onRemoved?: RemovedCallback
  private readonly onError?: (error: unknown) => void

  private pendingRecords: MutationRecord[] = []
  private scheduled = false
  private idleHandle: number | null = null
  private disconnected = false

  /**
   * Create a new element existence observer.
   *
   * @param options - Optional configuration for root, callbacks, and batching.
   */
  public constructor(options: ElementExistenceObserverOptions = {}) {
    const {
      root,
      idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
      maxChunk = DEFAULT_MAX_CHUNK,
      onChange,
      onAdded,
      onRemoved,
      onError,
    } = options

    this.root = ElementExistenceObserver.isNode(root) ? root : CAN_ADD_LISTENERS ? document : null

    this.idleTimeoutMs = ElementExistenceObserver.sanitizeInt(
      idleTimeoutMs,
      DEFAULT_IDLE_TIMEOUT_MS,
      MIN_IDLE_TIMEOUT_MS,
    )
    this.maxChunk = ElementExistenceObserver.sanitizeInt(maxChunk, DEFAULT_MAX_CHUNK, MIN_MAX_CHUNK)

    this.onChange = onChange
    this.onAdded = onAdded
    this.onRemoved = onRemoved
    this.onError = onError

    if (HAS_MUTATION_OBSERVER && this.root) {
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
    // Else: SSR / non-DOM env — stay dormant; methods become safe no-ops.
  }

  /**
   * True if the watcher is actively observing (i.e., in a browser with MutationObserver).
   */
  public isActive(): boolean {
    return !!this.observer && !this.disconnected
  }

  /**
   * Stop observing and clear any pending work.
   */
  public disconnect(): void {
    if (this.disconnected) return
    this.disconnected = true

    this.observer?.disconnect()
    this.pendingRecords = []

    if (this.idleHandle !== null) {
      ElementExistenceObserver.cancelIdle(this.idleHandle)
      this.idleHandle = null
    }
    this.scheduled = false
  }

  /**
   * Synchronously process any pending mutation records.
   *
   * @remarks
   * Cancels any outstanding idle callbacks or timeouts and delivers changes immediately.
   */
  public flush(): void {
    if (!this.isActive()) return

    if (this.idleHandle !== null) {
      ElementExistenceObserver.cancelIdle(this.idleHandle)
      this.idleHandle = null
    }
    if (!this.scheduled && this.pendingRecords.length === 0) return

    this.scheduled = false
    this.processNow()
  }

  /**
   * Schedule processing of pending records using idle time or a timeout.
   */
  private scheduleProcess(): void {
    if (!this.isActive() || this.scheduled) return
    this.scheduled = true

    const run = (): void => {
      this.idleHandle = null
      this.scheduled = false
      this.processNow()
    }

    this.idleHandle = HAS_IDLE_CALLBACK
      ? window.requestIdleCallback(run, { timeout: this.idleTimeoutMs })
      : window.setTimeout(run, this.idleTimeoutMs)
  }

  /**
   * Process all currently pending mutation records immediately.
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
   * Narrow a value to `Node` when the DOM is available.
   */
  private static isNode(value: unknown): value is Node {
    return CAN_ADD_LISTENERS && typeof Node !== 'undefined' && value instanceof Node
  }

  /**
   * Normalize a numeric option to a finite integer and enforce a minimum.
   */
  private static sanitizeInt(value: unknown, fallback: number, min: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    const truncated = Math.trunc(value)
    return truncated >= min ? truncated : min
  }

  /**
   * Coalesce a set of mutation records into net added and removed nodes,
   * ignoring transient moves.
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
   */
  private static flattenElements(
    nodes: ReadonlySet<Node>,
    requireConnected: boolean,
  ): Set<Element> {
    const out = new Set<Element>()

    for (const node of nodes) {
      // If the node itself is an Element, include it
      if (node instanceof Element) {
        if (!requireConnected || node.isConnected) out.add(node)
        // Include all descendant elements
        node.querySelectorAll('*').forEach((el) => {
          if (!requireConnected || el.isConnected) out.add(el)
        })
        continue
      }

      // If it's a DocumentFragment (e.g., from templating), include its descendants
      if (node instanceof DocumentFragment) {
        node.querySelectorAll('*').forEach((el) => {
          if (!requireConnected || el.isConnected) out.add(el)
        })
      }
    }

    return out
  }

  /**
   * Cancel a previously scheduled idle callback or fallback timeout.
   */
  private static cancelIdle(handle: number): void {
    if (HAS_CANCEL_IDLE) {
      window.cancelIdleCallback(handle)
    } else if (CAN_ADD_LISTENERS) {
      window.clearTimeout(handle)
    }
  }

  /**
   * Drain and return the current list of pending mutation records.
   */
  private drainPending(): MutationRecord[] {
    const { pendingRecords: out } = this
    this.pendingRecords = []
    return out
  }

  /**
   * Deliver the aggregate change payload (added, removed, records) to the
   * `onChange` callback if configured.
   */
  private deliverAggregate(
    added: ReadonlySet<Element>,
    removed: ReadonlySet<Element>,
    records: readonly MutationRecord[],
  ): void {
    if (!this.onChange) return
    const payload: MutationChange = { added, removed, records }
    this.safeCall(() => this.onChange?.(payload))
  }

  /**
   * Deliver per-kind added/removed elements to their respective callbacks in
   * chunks if necessary.
   */
  private deliverPerKind(removed: ReadonlySet<Element>, added: ReadonlySet<Element>): void {
    const removedArr = removed.size > 0 ? [...removed] : []
    const addedArr = added.size > 0 ? [...added] : []

    if (this.onRemoved && removedArr.length > 0) {
      this.dispatchChunked(removedArr, this.onRemoved)
    }
    if (this.onAdded && addedArr.length > 0) {
      this.dispatchChunked(addedArr, this.onAdded)
    }
  }

  /**
   * Dispatch element arrays in chunks to respect the configured `maxChunk`
   * and avoid blocking the main thread.
   */
  private dispatchChunked(
    items: readonly Element[],
    fn: (chunk: readonly Element[]) => unknown,
  ): void {
    if (!this.isActive() || items.length === 0) return

    if (items.length <= this.maxChunk) {
      this.safeCall(() => fn(items))
      return
    }

    let index = 0
    const run = (): void => {
      if (!this.isActive()) return
      const end = Math.min(items.length, index + this.maxChunk)
      const chunk = items.slice(index, end)
      index = end

      this.safeCall(() => fn(chunk))

      if (index < items.length) {
        if (HAS_IDLE_CALLBACK) {
          window.requestIdleCallback(run, { timeout: this.idleTimeoutMs })
        } else if (CAN_ADD_LISTENERS) {
          window.setTimeout(run, this.idleTimeoutMs)
        }
      }
    }

    run()
  }

  /**
   * Normalize sync/async callbacks and centralize error handling.
   */
  private safeCall(invoke: () => unknown): void {
    try {
      const result = invoke()
      Promise.resolve(result).catch((error: unknown) => {
        this.onError?.(error)
      })
    } catch (error) {
      this.onError?.(error)
    }
  }
}

export default ElementExistenceObserver
