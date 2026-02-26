// tests/utils.ts
import { rs } from '@rstest/core'
import {
  EntryInteractionTrackerHost,
  type EntryInteractionDetector,
} from '../entry-tracking/EntryInteractionTrackerHost'
import ElementExistenceObserver from '../entry-tracking/registry/ElementExistenceObserver'
import { EntryElementRegistry } from '../entry-tracking/registry/EntryElementRegistry'

interface IOEntryInit {
  target: Element
  isIntersecting: boolean
  intersectionRatio: number
}

type IOCallback = (entries: IntersectionObserverEntry[]) => void

/** Minimal IntersectionObserver polyfill for driving test scenarios. */
export class FakeIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly thresholds: readonly number[]

  private readonly cb: IOCallback
  private readonly observed = new Set<Element>()
  private readonly queue: IntersectionObserverEntry[] = []

  constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
    this.cb = cb
    this.root = opts?.root ?? null
    this.rootMargin = opts?.rootMargin ?? '0px'
    this.thresholds =
      opts?.threshold == null
        ? [0]
        : Array.isArray(opts.threshold)
          ? opts.threshold
          : [opts.threshold]
  }

  observe = (el: Element): void => {
    this.observed.add(el)
  }

  unobserve = (el: Element): void => {
    this.observed.delete(el)
  }

  disconnect = (): void => {
    this.observed.clear()
    this.queue.length = 0
  }

  /** Spec API: return and clear any queued records. */
  takeRecords(): IntersectionObserverEntry[] {
    const out = this.queue.slice()
    this.queue.length = 0
    return out
  }

  /** Drive an IO cycle for a specific element. */
  trigger(entry: IOEntryInit): void {
    if (!this.observed.has(entry.target)) return

    const boundingClientRect: DOMRectReadOnly = {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      height: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
    const intersectionRect: DOMRectReadOnly = {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      height: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }

    const e: IntersectionObserverEntry = {
      target: entry.target,
      isIntersecting: entry.isIntersecting,
      intersectionRatio: entry.intersectionRatio,
      time: 0,
      boundingClientRect,
      intersectionRect,
      rootBounds: null,
    }
    this.queue.push(e)
    this.cb([e])
  }
}

export function installIOPolyfill(): {
  getLast: () => FakeIntersectionObserver | null
  restore: () => void
} {
  const instances: FakeIntersectionObserver[] = []

  class Polyfilled extends FakeIntersectionObserver {
    constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
      super(cb, opts)
      instances.push(this)
    }
  }

  // Type guard to safely read from globalThis without unsafe narrowing.
  function hasIO(
    g: typeof globalThis,
  ): g is typeof globalThis & { IntersectionObserver: typeof IntersectionObserver } {
    return typeof (g as Record<string, unknown>).IntersectionObserver === 'function'
  }

  const g = globalThis
  let prev: typeof IntersectionObserver | null = null
  let hadPrev = false

  if (hasIO(g)) {
    hadPrev = true
    // prefer-destructuring compliant read:
    ;({ IntersectionObserver: prev } = g)
  }

  // Define the polyfill without unsafe assertions.
  Object.defineProperty(g, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: Polyfilled,
  })

  return {
    getLast: (): FakeIntersectionObserver | null => {
      const [last] = instances.slice(-1)
      return last ?? null
    },
    restore: (): void => {
      if (hadPrev && prev) {
        Object.defineProperty(g, 'IntersectionObserver', {
          configurable: true,
          writable: true,
          value: prev,
        })
      } else {
        // remove if we added it originally
        Reflect.deleteProperty(g, 'IntersectionObserver')
      }
    },
  }
}

/** Create and attach a test element. */
export function makeElement(tag = 'div'): HTMLElement {
  const el = document.createElement(tag)
  document.body.appendChild(el)
  return el
}

/** Change document visibility and emit the proper event. */
export function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Small helper to create a controllable promise. */
export function deferred<T = void>(): {
  promise: Promise<T>
  resolve: (v: T | PromiseLike<T>) => void
  reject: (e?: unknown) => void
} {
  let resolve: (v: T | PromiseLike<T>) => void = () => {
    throw new Error('Deferred resolver not initialized')
  }
  let reject: (e?: unknown) => void = () => {
    throw new Error('Deferred rejecter not initialized')
  }
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}

interface EntryTrackingHarness<TStartOptions = never, TElementOptions = never> {
  readonly entryElementRegistry: EntryElementRegistry
  readonly entryExistenceObserver: ElementExistenceObserver
  readonly tracker: EntryInteractionTrackerHost<TStartOptions, TElementOptions>
  readonly cleanup: () => void
}

export function createEntryTrackingHarness<TStartOptions = never, TElementOptions = never>(
  detector: EntryInteractionDetector<TStartOptions, TElementOptions>,
): EntryTrackingHarness<TStartOptions, TElementOptions> {
  const entryExistenceObserver = new ElementExistenceObserver()
  const entryElementRegistry = new EntryElementRegistry(entryExistenceObserver)
  const tracker = new EntryInteractionTrackerHost(detector, entryElementRegistry)

  return {
    entryElementRegistry,
    entryExistenceObserver,
    tracker,
    cleanup: (): void => {
      tracker.stop()
      entryElementRegistry.disconnect()
      entryExistenceObserver.disconnect()
    },
  }
}

/** Advance timers and flush microtasks. */
export async function advance(ms: number): Promise<void> {
  rs.advanceTimersByTime(ms)
  await Promise.resolve()
}
