/**
 * IntersectionObserver that:
 * - Tracks cumulative visible time per element
 * - Fires a sync/async callback exactly once per observed element
 * - Retries on failure with exponential backoff (retry scope is per "visibility cycle")
 * - Pauses when the page/tab is hidden; resumes cleanly
 * - Coalesces retries to avoid duplicate concurrent attempts
 * - Supports per-element overrides and optional data on observe()
 * - Periodically sweeps orphaned states to prevent memory growth
 *
 * Assumes DOM environment (browser).
 */

import { CAN_ADD_LISTENERS } from '../global-constants'
import {
  DEFAULTS,
  type EffectiveObserverOptions,
  type ElementState,
  type ElementViewCallback,
  type ElementViewElementOptions,
  type ElementViewObserverOptions,
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
 * Observes elements for dwell time and triggers the callback (with retries)
 * once per element.
 *
 * @remarks
 * Uses IntersectionObserver under the hood and maintains per-element state to
 * track visibility, accumulated dwell time, and retry scheduling.
 */
class ElementViewObserver {
  private readonly callback: ElementViewCallback
  private readonly opts: EffectiveObserverOptions
  private readonly io: IntersectionObserver
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private boundVisibilityHandler: (() => void) | null = null
  private sweepInterval: Interval | null = null

  /**
   * Create a new element view observer.
   *
   * @param callback - Callback invoked once per element when dwell/visibility
   *   requirements are met.
   * @param options - Optional observer-level tuning options.
   */
  public constructor(callback: ElementViewCallback, options?: ElementViewObserverOptions) {
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
    if (CAN_ADD_LISTENERS) {
      this.boundVisibilityHandler = () => {
        this.onPageVisibilityChange()
      }
      document.addEventListener('visibilitychange', this.boundVisibilityHandler)
    }
  }

  /**
   * Observe an element with optional per-element overrides and data.
   *
   * @param element - Element to observe.
   * @param options - Optional per-element overrides and callback data.
   */
  public observe(element: Element, options?: ElementViewElementOptions): void {
    let state = this.states.get(element)
    if (!state) {
      state = this.createState(element, options)
      this.states.set(element, state)
      this.activeStates.add(state)
      this.ensureSweeper()
    }
    this.io.observe(element)
  }

  /**
   * Stop observing an element and release its state and timers.
   *
   * @param element - Element to stop observing.
   */
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

  /**
   * Disconnect the underlying IntersectionObserver and clear all state.
   */
  public disconnect(): void {
    this.io.disconnect()
    for (const s of this.activeStates) {
      clearFireTimer(s)
      cancelRetry(s)
      s.done = true
      s.strongRef = null
    }
    this.activeStates.clear()
    if (CAN_ADD_LISTENERS && this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler)
      this.boundVisibilityHandler = null
    }
    this.stopSweeper()
  }

  /**
   * Lightweight, readonly stats snapshot for a given element.
   *
   * @param element - Element for which to retrieve stats.
   * @returns A subset of {@link ElementState} or `null` if no state is tracked.
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

  /**
   * Normalize high-level observer options into an effective configuration.
   */
  private static initOptions(options?: ElementViewObserverOptions): EffectiveObserverOptions {
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

  /**
   * Create a new per-element state object using observer defaults and any
   * per-element overrides.
   */
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

  /**
   * Handle page visibility changes by pausing/resuming timers and retries.
   */
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

  /**
   * Update a state in response to the page becoming hidden.
   *
   * @remarks
   * Freezes dwell time accumulation and converts any active retry into a
   * pending retry with remaining delay.
   */
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

  /**
   * Update a state in response to the page becoming visible again.
   */
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

  /**
   * Handle IntersectionObserver notifications and update per-element
   * visibility state.
   */
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

  /**
   * Mark a state as visible and schedule the callback if dwell time is met.
   */
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

  /**
   * Mark a state as not visible and cancel any scheduled callback or retry.
   */
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

  /**
   * Schedule firing of the callback when the remaining dwell requirement is met,
   * if appropriate for the current state.
   */
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

  /**
   * Schedule a retry attempt after a delay, if the element is currently visible.
   */
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

  /**
   * Immediately attempt to fire the callback for a state and record the
   * total dwell time used for this attempt.
   */
  private trigger(state: ElementState): void {
    if (state.done || state.inFlight) return
    const now = NOW()
    const total = state.accumulatedMs + (state.visibleSince !== null ? now - state.visibleSince : 0)
    cancelRetry(state)
    state.pendingRetry = false
    clearFireTimer(state)
    void this.attemptCallback(state, total)
  }

  /**
   * Perform a single callback attempt for a state, handling success or failure.
   *
   * @param state - State to attempt the callback for.
   * @param preTotal - Optional precomputed dwell time in ms.
   */
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

  /**
   * Handle a successful callback attempt by marking the state as done and
   * unobserving the element.
   */
  private onAttemptSuccess(state: ElementState, element: Element): void {
    state.inFlight = false
    state.done = true
    this.safeAutoUnobserve(element, state)
  }

  /**
   * Handle a failed callback attempt by either scheduling another retry or
   * marking the state as exhausted.
   */
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

  /**
   * Handle the case where the maximum number of retries has been exceeded.
   */
  private onRetriesExceeded(state: ElementState): void {
    cancelRetry(state)
    state.pendingRetry = false
    state.done = true
    const element = derefElement(state)
    if (element) this.safeAutoUnobserve(element, state)
    else this.finalizeDroppedState(state)
  }

  /**
   * Finalize a state for an element that has been garbage-collected or otherwise
   * lost, ensuring timers are cleared and state maps are cleaned up.
   */
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

  /**
   * Attempt to unobserve an element and fall back to manual cleanup if an
   * error occurs.
   */
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

  /**
   * Ensure there is an active sweeper interval to clean up orphaned states.
   */
  private ensureSweeper(): void {
    if (this.sweepInterval !== null) return
    this.sweepInterval = setInterval(() => {
      this.sweepOrphans()
    }, DEFAULTS.SWEEP_INTERVAL_MS)
  }

  /**
   * Stop the sweeper interval if running.
   */
  private stopSweeper(): void {
    if (this.sweepInterval === null) return
    clearInterval(this.sweepInterval)
    this.sweepInterval = null
  }

  /**
   * Stop the sweeper interval when there are no active states left.
   */
  private maybeStopSweeper(): void {
    if (this.activeStates.size === 0) this.stopSweeper()
  }

  /**
   * Remove state for elements that are no longer present in the document or
   * whose references have been lost.
   */
  private sweepOrphans(): void {
    if (!CAN_ADD_LISTENERS) return
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
