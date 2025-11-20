/**
 * ElementExistenceObserver
 * - Observes childList + subtree
 * - Coalesces moves (reparent/reorder ignored)
 * - Filters to Element (for IntersectionObserver)
 * - Batches & chunks delivery in idle time
 * - Two optional per-kind callbacks + one aggregate callback
 */

export const DEFAULT_IDLE_TIMEOUT_MS = 100
export const DEFAULT_MAX_CHUNK = 250
export const MIN_IDLE_TIMEOUT_MS = 16 // ~1 frame
export const MIN_MAX_CHUNK = 1

export const CAN_USE_DOM = typeof window !== 'undefined' && typeof document !== 'undefined'
export const HAS_MUTATION_OBSERVER = CAN_USE_DOM && typeof MutationObserver !== 'undefined'
export const HAS_IDLE_CALLBACK = CAN_USE_DOM && typeof window.requestIdleCallback === 'function'
export const HAS_CANCEL_IDLE = CAN_USE_DOM && typeof window.cancelIdleCallback === 'function'

export interface MutationChange {
  readonly added: ReadonlySet<Element>
  readonly removed: ReadonlySet<Element>
  readonly records: readonly MutationRecord[]
}

export type AddedCallback = (elements: readonly Element[]) => unknown
export type RemovedCallback = (elements: readonly Element[]) => unknown
export type MutationChangeCallback = (change: MutationChange) => unknown

export interface ElementExistenceObserverOptions {
  readonly root?: Node
  readonly idleTimeoutMs?: number
  readonly maxChunk?: number
  readonly onChange?: MutationChangeCallback
  readonly onAdded?: AddedCallback
  readonly onRemoved?: RemovedCallback
  readonly onError?: (error: unknown) => void
}

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

    this.root = ElementExistenceObserver.isNode(root) ? root : CAN_USE_DOM ? document : null

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

  /** True if the watcher is actively observing (i.e., in a browser with MutationObserver). */
  public isActive(): boolean {
    return !!this.observer && !this.disconnected
  }

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

  private processNow(): void {
    if (!this.isActive() || this.pendingRecords.length === 0) return

    const records = this.drainPending()
    const { addedNodes, removedNodes } = ElementExistenceObserver.coalesce(records)
    const { added, removed } = ElementExistenceObserver.toElementSets(addedNodes, removedNodes)

    if (added.size === 0 && removed.size === 0) return

    this.deliverAggregate(added, removed, records)
    this.deliverPerKind(removed, added) // removals first, then additions
  }

  private static isNode(value: unknown): value is Node {
    return CAN_USE_DOM && typeof Node !== 'undefined' && value instanceof Node
  }

  private static sanitizeInt(value: unknown, fallback: number, min: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    const truncated = Math.trunc(value)
    return truncated >= min ? truncated : min
  }

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

  private static toElementSets(
    addedNodes: ReadonlySet<Node>,
    removedNodes: ReadonlySet<Node>,
  ): { added: Set<Element>; removed: Set<Element> } {
    const added = ElementExistenceObserver.flattenElements(addedNodes, true)
    const removed = ElementExistenceObserver.flattenElements(removedNodes, false)
    return { added, removed }
  }

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
  private static cancelIdle(handle: number): void {
    if (HAS_CANCEL_IDLE) {
      window.cancelIdleCallback(handle)
    } else if (CAN_USE_DOM) {
      window.clearTimeout(handle)
    }
  }

  private drainPending(): MutationRecord[] {
    const { pendingRecords: out } = this
    this.pendingRecords = []
    return out
  }

  private deliverAggregate(
    added: ReadonlySet<Element>,
    removed: ReadonlySet<Element>,
    records: readonly MutationRecord[],
  ): void {
    if (!this.onChange) return
    const payload: MutationChange = { added, removed, records }
    this.safeCall(() => this.onChange?.(payload))
  }

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
        } else if (CAN_USE_DOM) {
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
