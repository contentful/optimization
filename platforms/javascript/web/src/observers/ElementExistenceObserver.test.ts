import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import ElementExistenceObserver, {
  DEFAULT_IDLE_TIMEOUT_MS,
  MIN_IDLE_TIMEOUT_MS,
} from './ElementExistenceObserver'

/**
 * Minimal record shape the implementation iterates over.
 * (We only need addedNodes/removedNodes to be iterable.)
 */
type MinimalRecord = Readonly<{
  addedNodes: readonly Node[]
  removedNodes: readonly Node[]
}>

/**
 * Controllable MutationObserver stub:
 * - Captures the callback the SUT passes in.
 * - Lets tests call `emit([...])` to deliver records on demand.
 */
class MOStub {
  private readonly cb: (records: readonly MinimalRecord[]) => void
  public constructor(callback: (records: readonly MinimalRecord[]) => void) {
    this.cb = callback
    instances.push(this)
  }
  // These methods exist so the SUT considers the observer "active".
  public observe(): void {
    /* no-op */
  }
  public disconnect(): void {
    /* no-op */
  }
  public takeRecords(): never[] {
    return []
  }
  public emit(records: readonly MinimalRecord[]): void {
    this.cb(records)
  }
}

/**
 * Track created MO stubs (the SUT creates exactly one per instance).
 */
const instances: MOStub[] = []

/**
 * For tests that slice delivery via idle callbacks, route idle to timers so
 * Vitest fake timers can advance deterministically.
 */
const routeIdleThroughTimeout = (): { restore: () => void } => {
  if (
    typeof window.requestIdleCallback !== 'function' ||
    typeof window.cancelIdleCallback !== 'function'
  ) {
    return {
      restore: () => {
        /* no-op */
      },
    }
  }
  const ricSpy = rs
    .spyOn(window, 'requestIdleCallback')
    .mockImplementation(
      (
        callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
        options?: { timeout?: number },
      ) => {
        const { timeout = 0 } = options ?? {}
        const run = (): void => {
          callback({ didTimeout: true, timeRemaining: () => 0 })
        }
        return window.setTimeout(run, timeout)
      },
    )
  const cicSpy = rs.spyOn(window, 'cancelIdleCallback').mockImplementation((handle: number) => {
    window.clearTimeout(handle)
  })
  return {
    restore: () => {
      ricSpy.mockRestore()
      cicSpy.mockRestore()
    },
  }
}

describe('ElementExistenceObserver', () => {
  let originalMO: typeof MutationObserver

  beforeEach(() => {
    // Save & stub global MutationObserver with our controllable stub.
    ;({ MutationObserver: originalMO } = window)
    rs.stubGlobal('MutationObserver', MOStub)
    instances.length = 0
    document.body.innerHTML = ''
  })

  afterEach(() => {
    // Restore global state and timers/spies between tests.
    rs.restoreAllMocks()
    rs.useRealTimers()
    rs.stubGlobal('MutationObserver', originalMO)
    document.body.innerHTML = ''
  })

  it('is active in a DOM environment and observes subtree', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onChange = rs.fn()
    const eo = new ElementExistenceObserver({ root, onChange, idleTimeoutMs: MIN_IDLE_TIMEOUT_MS })

    // Prepare an actual Element so isConnected === true for "added".
    const child = document.createElement('div')
    root.append(child)

    // Emit a childList "added" mutation.
    const [mo] = instances
    mo?.emit([{ addedNodes: [child], removedNodes: [] }])

    // Force immediate processing.
    eo.flush()

    expect(onChange).toHaveBeenCalledTimes(1)
    const {
      mock: {
        calls: [
          [
            { added, removed, records } = {
              added: new Set<Element>(),
              removed: new Set<Element>(),
              records: [],
            },
          ] = [],
        ] = [],
      },
    } = onChange
    expect(added.size).toBe(1)
    expect(removed.size).toBe(0)
    expect(records.length).toBe(1)

    eo.disconnect()
  })

  it('delivers aggregate first, then per-kind (removed before added)', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const events: string[] = []
    const onChange = rs.fn(
      ({ added, removed }: { added: ReadonlySet<Element>; removed: ReadonlySet<Element> }) => {
        events.push('change')
        expect(added.size + removed.size > 0).toBe(true)
      },
    )
    const onRemoved = rs.fn(() => {
      events.push('removed')
    })
    const onAdded = rs.fn(() => {
      events.push('added')
    })

    const eo = new ElementExistenceObserver({
      root,
      onChange,
      onAdded,
      onRemoved,
      idleTimeoutMs: MIN_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    // Added case
    const addedEl = document.createElement('span')
    root.append(addedEl)
    mo?.emit([{ addedNodes: [addedEl], removedNodes: [] }])
    eo.flush()
    expect(events).toEqual(['change', 'added'])

    // Removed case
    events.length = 0
    const removedEl = document.createElement('em')
    root.append(removedEl)
    // removal does not require isConnected === true afterwards
    mo?.emit([{ addedNodes: [], removedNodes: [removedEl] }])
    eo.flush()
    expect(events).toEqual(['change', 'removed'])

    eo.disconnect()
  })

  it('coalesces moves (reparent/reorder) so no add/remove delivered', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onChange = rs.fn()
    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    const eo = new ElementExistenceObserver({
      root,
      onChange,
      onAdded,
      onRemoved,
      idleTimeoutMs: MIN_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    // Baseline: an initial addition is delivered.
    const el = document.createElement('i')
    root.append(el)
    mo?.emit([{ addedNodes: [el], removedNodes: [] }])
    eo.flush()
    expect(onAdded).toHaveBeenCalledTimes(1)

    onAdded.mockClear()
    onRemoved.mockClear()
    onChange.mockClear()

    // Simulate a reparent move: remove then add the same node within the batch.
    mo?.emit([
      { addedNodes: [], removedNodes: [el] },
      { addedNodes: [el], removedNodes: [] },
    ])
    eo.flush()

    // Coalesced: no per-kind or aggregate deliveries (since added/removed sets are empty)
    expect(onAdded).toHaveBeenCalledTimes(0)
    expect(onRemoved).toHaveBeenCalledTimes(0)
    expect(onChange).toHaveBeenCalledTimes(0)

    eo.disconnect()
  })

  it('filters to Elements (ignores non-Element nodes)', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onChange = rs.fn()
    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    const eo = new ElementExistenceObserver({
      root,
      onChange,
      onAdded,
      onRemoved,
      idleTimeoutMs: MIN_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    // Text nodes should be ignored for per-kind and aggregate (sets end up empty).
    const text = document.createTextNode('hello')
    root.append(text)
    mo?.emit([{ addedNodes: [text], removedNodes: [] }])
    eo.flush()

    expect(onAdded).toHaveBeenCalledTimes(0)
    expect(onRemoved).toHaveBeenCalledTimes(0)
    expect(onChange).toHaveBeenCalledTimes(0)

    eo.disconnect()
  })

  it('chunks per-kind delivery according to maxChunk across idle slices', () => {
    rs.useFakeTimers()
    const { restore } = routeIdleThroughTimeout()

    const root = document.createElement('div')
    document.body.append(root)

    const onAdded = rs.fn()
    const maxChunk = 3
    const eo = new ElementExistenceObserver({
      root,
      onAdded,
      maxChunk,
      idleTimeoutMs: MIN_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    // Create 7 connected elements so isConnected === true for "added".
    const elements: HTMLElement[] = []
    for (let i = 0; i < 7; i += 1) {
      const el = document.createElement('div')
      elements.push(el)
      root.append(el)
    }

    // Emit a single batch with all 7 added elements.
    mo?.emit([{ addedNodes: elements, removedNodes: [] }])

    // First chunk happens synchronously inside dispatchChunked's initial run().
    eo.flush()
    expect(onAdded).toHaveBeenCalledTimes(1)
    {
      const {
        mock: { calls: [[firstChunk = []] = []] = [] },
      } = onAdded
      const [a, b, c] = firstChunk
      expect(firstChunk.length).toBe(3)
      expect(a).toBe(elements[0])
      expect(b).toBe(elements[1])
      expect(c).toBe(elements[2])
    }

    // Subsequent chunks are scheduled via idle (routed through setTimeout).
    rs.runOnlyPendingTimers()
    expect(onAdded).toHaveBeenCalledTimes(2)
    {
      const {
        mock: { calls: [, [secondChunk = []] = []] = [] },
      } = onAdded
      const [a, b, c] = secondChunk
      expect(secondChunk.length).toBe(3)
      expect(a).toBe(elements[3])
      expect(b).toBe(elements[4])
      expect(c).toBe(elements[5])
    }

    rs.runOnlyPendingTimers()
    expect(onAdded).toHaveBeenCalledTimes(3)
    {
      const {
        mock: { calls: [, , [finalChunk = []] = []] = [] },
      } = onAdded
      const [a] = finalChunk
      expect(finalChunk.length).toBe(1)
      expect(a).toBe(elements[6])
    }

    eo.disconnect()
    restore()
  })

  it('flush() processes immediately and cancels pending idle work', () => {
    rs.useFakeTimers()
    const { restore } = routeIdleThroughTimeout()

    const root = document.createElement('div')
    document.body.append(root)

    const onAdded = rs.fn()
    const eo = new ElementExistenceObserver({
      root,
      onAdded,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    const el = document.createElement('section')
    root.append(el)

    // Queue a mutation and immediately flush (no idle tick).
    mo?.emit([{ addedNodes: [el], removedNodes: [] }])
    eo.flush()

    expect(onAdded).toHaveBeenCalledTimes(1)

    // Any pending idle work should have been canceled by flush().
    rs.runOnlyPendingTimers()
    expect(onAdded).toHaveBeenCalledTimes(1)

    eo.disconnect()
    restore()
  })

  it('reports sync and async callback errors via onError', async () => {
    const root = document.createElement('div')
    document.body.append(root)

    const errors: unknown[] = []
    const onError = rs.fn((error: unknown) => {
      errors.push(error)
    })
    const onChange = rs.fn(async () => await Promise.reject(new Error('async-aggregate')))
    const onAdded = rs.fn(() => {
      throw new Error('sync-added')
    })

    const eo = new ElementExistenceObserver({
      root,
      onChange,
      onAdded,
      onError,
      idleTimeoutMs: MIN_IDLE_TIMEOUT_MS,
    })
    const [mo] = instances

    // Queue a mutation and immediately flush (no idle tick).
    const el = document.createElement('div')
    root.append(el)

    mo?.emit([{ addedNodes: [el], removedNodes: [] }])
    eo.flush()

    // Allow the Promise rejection from onChange to reach onError via safeCall.
    await Promise.resolve()
    await Promise.resolve() // ← add this extra microtask turn

    expect(onError).toHaveBeenCalledTimes(2)
    const {
      mock: {
        calls: { 0: e1, 1: e2 },
      },
    } = onError
    const bag = new Set([e1, e2])
    expect(bag.size).toBe(2)

    eo.disconnect()
  })
})
