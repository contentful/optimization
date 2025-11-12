/**
 * IntersectionObserver that:
 * - Tracks cumulative visible time per element
 * - Fires a sync/async callback exactly once per observed element
 * - Retries on failure with exponential backoff (retry scope is per "visibility cycle")
 * - Uses WeakRef to avoid strong element references (with a safe fallback when unavailable)
 * - Pauses when the page/tab is hidden; resumes cleanly
 * - Coalesces retries to avoid duplicate concurrent attempts
 * - Supports per-element overrides and optional data on observe()
 * - Periodically sweeps orphaned states to prevent memory growth
 *
 * Assumes DOM environment (browser).
 */

import {
  DEFAULTS,
  type EffectiveOptions,
  type ElementState,
  type ElementViewCallback,
  type ElementViewElementOptions,
  type ElementViewOptions,
  HAS_DOC,
  type Interval,
  NOW,
  Num,
  type PerElementEffectiveOptions,
  cancelRetry,
  clearFireTimer,
  derefElement,
  isPageVisible,
  withJitter,
} from './ElementView'

/**
 * Observes elements for dwell time and triggers the callback (with retries) once per element.
 */
class ElementViewObserver {
  private readonly callback: ElementViewCallback
  private readonly opts: EffectiveOptions
  private readonly io: IntersectionObserver
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private boundVisibilityHandler: (() => void) | null = null
  private sweepInterval: Interval | null = null

  public constructor(callback: ElementViewCallback, options?: ElementViewOptions) {
    this.callback = callback
    this.opts = ElementViewObserver.initOptions(options)
    this.io = new IntersectionObserver(
      (entries) => {
        this.onIntersect(entries)
      },
      {
        root: this.opts.root ?? null,
        rootMargin: this.opts.rootMargin,
        threshold: this.opts.minVisibleRatio === 0 ? [0] : [0, this.opts.minVisibleRatio],
      },
    )
    if (HAS_DOC) {
      this.boundVisibilityHandler = () => {
        this.onPageVisibilityChange()
      }
      document.addEventListener('visibilitychange', this.boundVisibilityHandler)
    }
  }

  /** Observe an element with optional per-element overrides and data. */
  public observe(element: Element, perElement?: ElementViewElementOptions): void {
    let state = this.states.get(element)
    if (!state) {
      state = this.createState(element, perElement)
      this.states.set(element, state)
      this.activeStates.add(state)
      this.ensureSweeper()
    }
    this.io.observe(element)
  }

  /** Stop observing element and release state/timers. */
  public unobserve(element: Element): void {
    this.io.unobserve(element)
    const state = this.states.get(element)
    if (!state) return
    clearFireTimer(state)
    cancelRetry(state)
    state.done = true
    this.activeStates.delete(state)
    if (state.strongRef === element) state.strongRef = null
    this.states.delete(element)
    this.maybeStopSweeper()
  }

  /** Disconnect IO and clear all state. */
  public disconnect(): void {
    this.io.disconnect()
    for (const s of this.activeStates) {
      clearFireTimer(s)
      cancelRetry(s)
      s.done = true
      s.strongRef = null
    }
    this.activeStates.clear()
    if (HAS_DOC && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler)
      this.boundVisibilityHandler = null
    }
    this.stopSweeper()
  }

  /**
   * Lightweight, readonly stats snapshot for a given element.
   * Returns null if no state is tracked for the element.
   */
  public getStats(
    element: Element,
  ): Readonly<
    Pick<
      ElementState,
      | 'accumulatedMs'
      | 'visibleSince'
      | 'attempts'
      | 'done'
      | 'inFlight'
      | 'pendingRetry'
      | 'lastKnownVisible'
    >
  > | null {
    const state = this.states.get(element)
    return state
      ? {
          accumulatedMs: state.accumulatedMs,
          visibleSince: state.visibleSince,
          attempts: state.attempts,
          done: state.done,
          inFlight: state.inFlight,
          pendingRetry: state.pendingRetry,
          lastKnownVisible: state.lastKnownVisible,
        }
      : null
  }

  private static initOptions(options?: ElementViewOptions): EffectiveOptions {
    return {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, DEFAULTS.DWELL_MS),
      minVisibleRatio: Num.clamp01(options?.minVisibleRatio, DEFAULTS.RATIO),
      root: options?.root ?? null,
      rootMargin: options?.rootMargin ?? '0px',
      maxRetries: Num.nonNeg(options?.maxRetries, DEFAULTS.MAX_RETRIES),
      retryBackoffMs: Num.nonNeg(options?.retryBackoffMs, DEFAULTS.BACKOFF_MS),
      backoffMultiplier: Num.atLeast1(options?.backoffMultiplier, DEFAULTS.MULTIPLIER),
    }
  }

  private createState(element: Element, options?: ElementViewElementOptions): ElementState {
    const opts: PerElementEffectiveOptions = {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, this.opts.dwellTimeMs),
      maxRetries: Num.nonNeg(options?.maxRetries, this.opts.maxRetries),
      retryBackoffMs: Num.nonNeg(options?.retryBackoffMs, this.opts.retryBackoffMs),
      backoffMultiplier: Num.atLeast1(options?.backoffMultiplier, this.opts.backoffMultiplier),
    }
    const hasWeakRef = typeof WeakRef === 'function'
    return {
      ref: hasWeakRef ? new WeakRef(element) : null,
      strongRef: hasWeakRef ? null : element,
      opts,
      data: options?.data,
      accumulatedMs: 0,
      visibleSince: null,
      fireTimer: null,
      retryTimer: null,
      retryScheduledAt: null,
      retryDelayMs: null,
      pendingRetry: false,
      attempts: 0,
      done: false,
      inFlight: false,
      lastKnownVisible: false,
    }
  }

  private onPageVisibilityChange(): void {
    const now = NOW()
    const hidden = !isPageVisible()
    for (const state of this.activeStates) {
      if (hidden) {
        ElementViewObserver.onHidden(state, now)
      } else {
        this.onResume(state, now)
      }
    }
    this.sweepOrphans()
  }

  private static onHidden(state: ElementState, now: number): void {
    if (state.done) return
    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = null
    }
    clearFireTimer(state)
    if (state.retryTimer !== null) {
      const elapsed = state.retryScheduledAt ? now - state.retryScheduledAt : 0
      const remaining =
        state.retryDelayMs !== null ? Math.max(0, state.retryDelayMs - elapsed) : null
      cancelRetry(state)
      if (remaining !== null) {
        state.pendingRetry = true
        state.retryDelayMs = remaining
        state.retryScheduledAt = null
      }
    }
  }

  private onResume(state: ElementState, now: number): void {
    if (state.done) return
    if (state.lastKnownVisible && state.visibleSince === null) {
      state.visibleSince = now
      this.scheduleFireIfDue(state, now)
    }
    if (
      state.pendingRetry &&
      !state.inFlight &&
      state.lastKnownVisible &&
      state.retryDelayMs !== null
    ) {
      this.scheduleRetry(state, state.retryDelayMs)
    }
  }

  private onIntersect(entries: readonly IntersectionObserverEntry[]): void {
    const now = NOW()
    for (const entry of entries) {
      const state = this.states.get(entry.target)
      if (!state || state.done) continue
      const visible =
        entry.isIntersecting &&
        entry.intersectionRatio >= this.opts.minVisibleRatio &&
        isPageVisible()
      visible ? this.onVisible(state, now) : ElementViewObserver.onNotVisible(state, now)
    }
    this.sweepOrphans()
  }

  private onVisible(state: ElementState, now: number): void {
    state.lastKnownVisible = true
    if (state.visibleSince === null) {
      state.visibleSince = now
      state.attempts = 0
      if (state.pendingRetry && !state.inFlight && state.retryDelayMs !== null) {
        this.scheduleRetry(state, state.retryDelayMs)
      } else {
        this.scheduleFireIfDue(state, now)
      }
      return
    }
    if (!state.pendingRetry && state.fireTimer === null && !state.inFlight) {
      this.scheduleFireIfDue(state, now)
    }
  }

  private static onNotVisible(state: ElementState, now: number): void {
    state.lastKnownVisible = false
    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = null
    }
    clearFireTimer(state)
    if (state.pendingRetry || state.retryTimer !== null) {
      cancelRetry(state)
      state.pendingRetry = false
      state.attempts = 0
    }
  }

  private scheduleFireIfDue(state: ElementState, now: number): void {
    if (state.done || state.inFlight || state.fireTimer !== null || state.pendingRetry) return
    const elapsed =
      state.accumulatedMs + (state.visibleSince !== null ? now - state.visibleSince : 0)
    const remaining = state.opts.dwellTimeMs - elapsed
    if (remaining <= 0) {
      this.trigger(state)
      return
    }
    state.fireTimer = setTimeout(() => {
      if (!state.done && state.lastKnownVisible && isPageVisible()) this.trigger(state)
      else clearFireTimer(state)
    }, Math.ceil(remaining))
  }

  private scheduleRetry(state: ElementState, delayMs: number): void {
    state.pendingRetry = true
    state.retryDelayMs = Math.max(0, Math.ceil(delayMs))
    if (!isPageVisible() || !state.lastKnownVisible || state.done || state.inFlight) return
    state.retryScheduledAt = NOW()
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null
      state.retryScheduledAt = null
      void this.attemptCallback(state)
    }, state.retryDelayMs)
  }

  private trigger(state: ElementState): void {
    if (state.done || state.inFlight) return
    const now = NOW()
    const total = state.accumulatedMs + (state.visibleSince !== null ? now - state.visibleSince : 0)
    cancelRetry(state)
    state.pendingRetry = false
    clearFireTimer(state)
    void this.attemptCallback(state, total)
  }

  private async attemptCallback(state: ElementState, preTotal?: number): Promise<void> {
    if (state.done || state.inFlight) return
    const element = derefElement(state)
    if (!element) {
      this.finalizeDroppedState(state)
      return
    }
    const attempt = state.attempts + 1
    state.attempts = attempt
    state.inFlight = true
    const totalVisibleMs =
      preTotal ??
      state.accumulatedMs + (state.visibleSince !== null ? NOW() - state.visibleSince : 0)
    try {
      await this.callback(element, { totalVisibleMs, attempts: attempt, data: state.data })
      this.onAttemptSuccess(state, element)
    } catch {
      this.onAttemptFailure(state)
    }
  }

  private onAttemptSuccess(state: ElementState, element: Element): void {
    state.inFlight = false
    state.done = true
    this.safeAutoUnobserve(element, state)
  }

  private onAttemptFailure(state: ElementState): void {
    state.inFlight = false
    if (state.attempts > state.opts.maxRetries) {
      this.onRetriesExceeded(state)
      return
    }
    const base =
      state.opts.retryBackoffMs * Math.pow(state.opts.backoffMultiplier, state.attempts - 1)
    const delay = withJitter(base)
    if (!state.lastKnownVisible || !isPageVisible()) {
      state.pendingRetry = true
      state.retryDelayMs = Math.ceil(delay)
      state.retryScheduledAt = null
      return
    }
    this.scheduleRetry(state, delay)
  }

  private onRetriesExceeded(state: ElementState): void {
    cancelRetry(state)
    state.pendingRetry = false
    state.done = true
    const element = derefElement(state)
    if (element) this.safeAutoUnobserve(element, state)
    else this.finalizeDroppedState(state)
  }

  private finalizeDroppedState(state: ElementState): void {
    clearFireTimer(state)
    cancelRetry(state)
    state.done = true
    this.activeStates.delete(state)
    if (state.strongRef) {
      this.states.delete(state.strongRef)
      state.strongRef = null
    }
    this.maybeStopSweeper()
  }

  private safeAutoUnobserve(element: Element, state: ElementState): void {
    try {
      this.unobserve(element)
    } catch {
      this.activeStates.delete(state)
      if (state.strongRef === element) {
        this.states.delete(element)
        state.strongRef = null
      }
      state.done = true
      this.maybeStopSweeper()
    }
  }

  private ensureSweeper(): void {
    if (this.sweepInterval !== null) return
    this.sweepInterval = setInterval(() => {
      this.sweepOrphans()
    }, DEFAULTS.SWEEP_INTERVAL_MS)
  }

  private stopSweeper(): void {
    if (this.sweepInterval === null) return
    clearInterval(this.sweepInterval)
    this.sweepInterval = null
  }

  private maybeStopSweeper(): void {
    if (this.activeStates.size === 0) this.stopSweeper()
  }

  private sweepOrphans(): void {
    if (!HAS_DOC) return
    for (const state of Array.from(this.activeStates)) {
      const element = derefElement(state)
      if (!element) {
        this.finalizeDroppedState(state)
        continue
      }
      const isConnected =
        typeof (element as Element & { isConnected?: boolean }).isConnected === 'boolean'
          ? (element as Element & { isConnected?: boolean }).isConnected
          : document.contains(element)
      if (!isConnected) this.safeAutoUnobserve(element, state)
    }
    this.maybeStopSweeper()
  }
}

export default ElementViewObserver
