/**
 * Lean IntersectionObserver-based dwell tracker for entry component views.
 *
 * Behavior:
 * - Fires callback after dwell threshold, then continues firing periodic
 *   duration updates while the same visibility cycle remains active
 * - Emits a final view-duration callback when visibility ends after first fire
 * - Pauses/resumes dwell timers across page visibility changes
 * - Coalesces concurrent callback attempts per element
 * - Sweeps orphan/disconnected element state to avoid leaks
 */

import { createScopedLogger } from '@contentful/optimization-core/logger'
import { safeCallAsync } from '../../../lib'
import {
  ensureSweeper,
  finalizeDroppedState,
  stopSweeper,
  sweepOrphans,
} from '../observerLifecycle'
import { addVisibilityChangeListener } from '../observerSupport'
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
const createViewId = (): string => crypto.randomUUID()

/**
 * Observe elements with `IntersectionObserver` and invoke a callback once dwell
 * is satisfied, then emit periodic duration updates while visible.
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
      viewDurationUpdateIntervalMs: Num.nonNeg(
        options?.viewDurationUpdateIntervalMs,
        DEFAULTS.VIEW_DURATION_UPDATE_INTERVAL_MS,
      ),
      minVisibleRatio: Num.clamp01(options?.minVisibleRatio, DEFAULTS.RATIO),
      root: options?.root ?? null,
      rootMargin: options?.rootMargin ?? '0px',
    }
  }

  private createState(element: Element, options?: ElementViewElementOptions): ElementState {
    const opts: PerElementEffectiveOptions = {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, this.opts.dwellTimeMs),
      viewDurationUpdateIntervalMs: Num.nonNeg(
        options?.viewDurationUpdateIntervalMs,
        this.opts.viewDurationUpdateIntervalMs,
      ),
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
      viewId: null,
      done: false,
      inFlight: false,
      lastKnownVisible: false,
      pendingFinal: false,
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
        this.onVisibilityEnd(state, now)
      }
    }

    this.sweepOrphans()
  }

  private onIntersecting(state: ElementState, now: number): void {
    if (!state.lastKnownVisible) {
      state.lastKnownVisible = true
      state.pendingFinal = false
      state.accumulatedMs = 0
      state.attempts = 0
      state.viewId = createViewId()
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

  private onVisibilityEnd(state: ElementState, now: number): void {
    if (!state.lastKnownVisible) return

    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = null
    }

    clearFireTimer(state)
    state.lastKnownVisible = false

    if (state.viewId === null || state.attempts === 0) {
      ElementViewObserver.resetVisibilityCycle(state)
      return
    }

    if (state.inFlight) {
      state.pendingFinal = true
      return
    }

    void this.attemptCallback(state, state.accumulatedMs)
  }

  private static resetVisibilityCycle(state: ElementState): void {
    state.lastKnownVisible = false
    state.pendingFinal = false
    state.accumulatedMs = 0
    state.visibleSince = null
    state.attempts = 0
    state.viewId = null
    clearFireTimer(state)
  }

  private scheduleFireIfDue(state: ElementState, now: number): void {
    if (
      state.done ||
      state.inFlight ||
      state.fireTimer !== null ||
      !state.lastKnownVisible ||
      !isPageVisible() ||
      state.viewId === null
    ) {
      return
    }

    const elapsed =
      state.accumulatedMs + (state.visibleSince !== null ? now - state.visibleSince : 0)
    const remaining = ElementViewObserver.getRemainingMsUntilNextFire(state, elapsed)

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
    if (state.done || state.inFlight || state.viewId === null) return

    if (state.visibleSince !== null) {
      state.accumulatedMs += now - state.visibleSince
      state.visibleSince = now
    }

    clearFireTimer(state)

    const { accumulatedMs: totalVisibleMs } = state
    void this.attemptCallback(state, totalVisibleMs)
  }

  private async attemptCallback(state: ElementState, totalVisibleMs: number): Promise<void> {
    if (state.done || state.inFlight || state.viewId === null) return

    const element = derefElement(state)

    if (!element) {
      this.finalizeDroppedState(state)
      return
    }

    state.inFlight = true
    state.attempts += 1
    const { viewId } = state

    await safeCallAsync(
      (): void | Promise<void> =>
        this.callback(element, {
          totalVisibleMs,
          viewId,
          attempts: state.attempts,
          data: state.data,
        }),
      (error) => {
        logger.error('Error in element view callback:', error)
      },
    )

    this.onAttemptSettled(state)
  }

  private onAttemptSettled(state: ElementState): void {
    state.inFlight = false

    if (state.done) return

    if (!state.lastKnownVisible) {
      if (state.pendingFinal && state.viewId !== null) {
        state.pendingFinal = false
        void this.attemptCallback(state, state.accumulatedMs)
        return
      }

      ElementViewObserver.resetVisibilityCycle(state)
      return
    }

    if (!isPageVisible()) return

    const now = NOW()
    state.visibleSince ??= now
    this.scheduleFireIfDue(state, now)
  }

  private static getRemainingMsUntilNextFire(state: ElementState, elapsedMs: number): number {
    const requiredElapsedMs =
      state.opts.dwellTimeMs + state.attempts * state.opts.viewDurationUpdateIntervalMs

    return requiredElapsedMs - elapsedMs
  }

  private finalizeDroppedState(state: ElementState): void {
    finalizeDroppedState(state, { activeStates: this.activeStates, states: this.states })
    this.maybeStopSweeper()
  }

  private ensureSweeper(): void {
    this.sweepInterval = ensureSweeper(
      this.sweepInterval,
      () => {
        this.sweepOrphans()
      },
      DEFAULTS.SWEEP_INTERVAL_MS,
    )
  }

  private stopSweeper(): void {
    this.sweepInterval = stopSweeper(this.sweepInterval)
  }

  private maybeStopSweeper(): void {
    if (this.activeStates.size === 0) this.stopSweeper()
  }

  private sweepOrphans(): void {
    sweepOrphans(
      { activeStates: this.activeStates, states: this.states },
      this.unobserve.bind(this),
    )
    this.maybeStopSweeper()
  }
}

export default ElementViewObserver
