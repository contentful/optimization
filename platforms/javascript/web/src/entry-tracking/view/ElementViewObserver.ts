/**
 * Lean IntersectionObserver-based dwell tracker for entry component views.
 *
 * Behavior:
 * - Fires callback once per observed element after dwell threshold in a single
 *   visibility cycle (no cross-cycle accumulation)
 * - Pauses/resumes dwell timers across page visibility changes
 * - Coalesces concurrent callback attempts per element
 * - Sweeps orphan/disconnected element state to avoid leaks
 */

import { createScopedLogger } from '@contentful/optimization-core'
import { CAN_ADD_LISTENERS } from '../../global-constants'
import { safeCallAsync } from '../../lib'
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
  clearFireTimer,
  derefElement,
  isPageVisible,
} from './element-view-observer-support'

const logger = createScopedLogger('Web:ElementViewObserver')

const addVisibilityChangeListener = (handler: () => void): (() => void) | undefined => {
  if (!CAN_ADD_LISTENERS) return undefined

  document.addEventListener('visibilitychange', handler)

  return () => {
    document.removeEventListener('visibilitychange', handler)
  }
}

/**
 * Observe elements with `IntersectionObserver` and invoke a callback once each
 * element satisfies its configured dwell-time visibility requirement.
 *
 * @public
 */
class ElementViewObserver {
  private readonly callback: ElementViewCallback
  private readonly opts: EffectiveObserverOptions
  private readonly io: IntersectionObserver
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private cleanupVisibilityListener?: () => void
  private sweepInterval: Interval | null = null

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

    this.cleanupVisibilityListener = addVisibilityChangeListener(() => {
      this.onPageVisibilityChange()
    })
  }

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

  public unobserve(element: Element): void {
    this.io.unobserve(element)

    const state = this.states.get(element)
    if (!state) return

    clearFireTimer(state)
    state.done = true
    this.activeStates.delete(state)

    if (state.strongRef === element) state.strongRef = null

    this.states.delete(element)
    this.maybeStopSweeper()
  }

  public disconnect(): void {
    this.io.disconnect()

    for (const state of this.activeStates) {
      clearFireTimer(state)
      state.done = true
      state.strongRef = null
    }

    this.activeStates.clear()

    this.cleanupVisibilityListener?.()
    this.cleanupVisibilityListener = undefined

    this.stopSweeper()
  }

  private static initOptions(options?: ElementViewObserverOptions): EffectiveObserverOptions {
    return {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, DEFAULTS.DWELL_MS),
      minVisibleRatio: Num.clamp01(options?.minVisibleRatio, DEFAULTS.RATIO),
      root: options?.root ?? null,
      rootMargin: options?.rootMargin ?? '0px',
    }
  }

  private createState(element: Element, options?: ElementViewElementOptions): ElementState {
    const opts: PerElementEffectiveOptions = {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, this.opts.dwellTimeMs),
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
      if (state.done) continue

      hidden
        ? ElementViewObserver.pauseVisibilityCycle(state, now)
        : this.resumeVisibilityCycle(state, now)
    }

    this.sweepOrphans()
  }

  private static pauseVisibilityCycle(state: ElementState, now: number): void {
    if (!state.lastKnownVisible) return

    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = null
    }

    clearFireTimer(state)
  }

  private resumeVisibilityCycle(state: ElementState, now: number): void {
    if (!state.lastKnownVisible || state.done || state.inFlight) return

    state.visibleSince ??= now

    this.scheduleFireIfDue(state, now)
  }

  private onIntersect(entries: readonly IntersectionObserverEntry[]): void {
    const now = NOW()

    for (const entry of entries) {
      const state = this.states.get(entry.target)

      if (!state || state.done) continue

      const intersectsThreshold =
        entry.isIntersecting && entry.intersectionRatio >= this.opts.minVisibleRatio

      if (intersectsThreshold) {
        this.onIntersecting(state, now)
      } else {
        ElementViewObserver.resetVisibilityCycle(state)
      }
    }

    this.sweepOrphans()
  }

  private onIntersecting(state: ElementState, now: number): void {
    if (!state.lastKnownVisible) {
      state.lastKnownVisible = true
      state.accumulatedMs = 0
      state.visibleSince = isPageVisible() ? now : null
      clearFireTimer(state)

      if (state.visibleSince !== null) {
        this.scheduleFireIfDue(state, now)
      }

      return
    }

    if (state.visibleSince === null && isPageVisible()) {
      state.visibleSince = now
    }

    this.scheduleFireIfDue(state, now)
  }

  private static resetVisibilityCycle(state: ElementState): void {
    state.lastKnownVisible = false
    state.accumulatedMs = 0
    state.visibleSince = null
    state.attempts = 0
    clearFireTimer(state)
  }

  private scheduleFireIfDue(state: ElementState, now: number): void {
    if (
      state.done ||
      state.inFlight ||
      state.fireTimer !== null ||
      !state.lastKnownVisible ||
      !isPageVisible()
    ) {
      return
    }

    const elapsed =
      state.accumulatedMs + (state.visibleSince !== null ? now - state.visibleSince : 0)
    const remaining = state.opts.dwellTimeMs - elapsed

    if (remaining <= 0) {
      this.trigger(state, now)
      return
    }

    state.fireTimer = setTimeout(() => {
      if (
        state.done ||
        state.inFlight ||
        !state.lastKnownVisible ||
        !isPageVisible() ||
        state.visibleSince === null
      ) {
        clearFireTimer(state)
        return
      }

      this.trigger(state, NOW())
    }, Math.ceil(remaining))
  }

  private trigger(state: ElementState, now: number): void {
    if (state.done || state.inFlight) return

    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = now
    }

    clearFireTimer(state)

    const { accumulatedMs: totalVisibleMs } = state
    void this.attemptCallback(state, totalVisibleMs)
  }

  private async attemptCallback(state: ElementState, totalVisibleMs: number): Promise<void> {
    if (state.done || state.inFlight) return

    const element = derefElement(state)

    if (!element) {
      this.finalizeDroppedState(state)
      return
    }

    state.inFlight = true
    state.attempts += 1

    await safeCallAsync(
      async () => {
        await this.callback(element, { totalVisibleMs, attempts: state.attempts, data: state.data })
      },
      (error) => {
        logger.error('Error in element view callback:', error)
      },
    )

    this.onAttemptSettled(state, element)
  }

  private onAttemptSettled(state: ElementState, element: Element): void {
    state.inFlight = false
    state.done = true
    this.safeAutoUnobserve(element, state)
  }

  private finalizeDroppedState(state: ElementState): void {
    clearFireTimer(state)
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
    for (const state of this.activeStates) {
      const element = derefElement(state)

      if (!element) {
        this.finalizeDroppedState(state)
        continue
      }

      const isConnected =
        typeof (element as Element & { isConnected?: boolean }).isConnected === 'boolean'
          ? (element as Element & { isConnected?: boolean }).isConnected
          : typeof document !== 'undefined' && document.contains(element)

      if (!isConnected) this.safeAutoUnobserve(element, state)
    }

    this.maybeStopSweeper()
  }
}

export default ElementViewObserver
