/**
 * Lean IntersectionObserver-based dwell tracker for entry views.
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
import { safeCallAsync } from '../../../lib/safeCall'
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
  clearFireTimer,
  createElementState,
  derefElement,
  getRemainingMsUntilNextFire,
  initElementViewObserverOptions,
  isPageVisible,
  pauseVisibilityCycle,
  resetVisibilityCycle,
} from './element-view-observer-support'
import ElementViewSourceController from './elementViewSourceController'

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
  private readonly sourceController: ElementViewSourceController
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private cleanupVisibilityListener?: () => void
  private sweepInterval: Interval | null = null

  public constructor(callback: ElementViewCallback, options?: ElementViewObserverOptions) {
    this.callback = callback
    this.opts = initElementViewObserverOptions(options)
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
    this.sourceController = new ElementViewSourceController(this.io, this.opts, {
      onDropped: this.finalizeDroppedState.bind(this),
      onHidden: this.onVisibilityEnd.bind(this),
      onVisible: this.onIntersecting.bind(this),
      sweep: this.sweepOrphans.bind(this),
    })

    this.cleanupVisibilityListener = addVisibilityChangeListener(() => {
      this.onPageVisibilityChange()
    })
  }

  public observe(element: Element, options?: ElementViewElementOptions): void {
    let state = this.states.get(element)

    if (!state) {
      state = createElementState(element, this.opts, options)
      this.states.set(element, state)
      this.activeStates.add(state)
      this.ensureSweeper()
    }

    this.sourceController.apply(state, false)
  }

  public unobserve(element: Element): void {
    const state = this.states.get(element)
    if (!state) {
      this.io.unobserve(element)
      return
    }

    this.sourceController.remove(state)
    clearFireTimer(state)
    state.done = true
    this.activeStates.delete(state)

    if (state.strongRef === element) state.strongRef = null

    this.states.delete(element)
    this.maybeStopSweeper()
  }

  public disconnect(): void {
    this.io.disconnect()
    this.sourceController.disconnect()

    for (const state of this.activeStates) {
      clearFireTimer(state)
      state.done = true
      state.strongRef = null
      state.target = null
    }

    this.activeStates.clear()

    this.cleanupVisibilityListener?.()
    this.cleanupVisibilityListener = undefined

    this.stopSweeper()
  }

  private onPageVisibilityChange(): void {
    const now = NOW()
    const hidden = !isPageVisible()

    for (const state of this.activeStates) {
      if (state.done) continue

      hidden ? pauseVisibilityCycle(state, now) : this.resumeVisibilityCycle(state, now)
    }

    if (!hidden) this.sourceController.requestVirtualMeasurement()

    this.sweepOrphans()
  }

  private resumeVisibilityCycle(state: ElementState, now: number): void {
    if (!state.lastKnownVisible || state.done || state.inFlight) return

    state.visibleSince ??= now

    this.scheduleFireIfDue(state, now)
  }

  private onIntersect(entries: readonly IntersectionObserverEntry[]): void {
    const now = NOW()

    for (const entry of entries) {
      const states = this.sourceController.getStatesForTarget(entry.target)

      if (!states) continue

      for (const state of states) {
        if (state.done) continue

        const intersectsThreshold =
          entry.isIntersecting && entry.intersectionRatio >= this.opts.minVisibleRatio

        if (intersectsThreshold) {
          this.onIntersecting(state, now)
        } else {
          this.onVisibilityEnd(state, now)
        }
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
      resetVisibilityCycle(state)
      return
    }

    if (state.inFlight) {
      state.pendingFinal = true
      return
    }

    void this.attemptCallback(state, state.accumulatedMs)
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
    const remaining = getRemainingMsUntilNextFire(state, elapsed)

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

      resetVisibilityCycle(state)
      return
    }

    if (!isPageVisible()) return

    const now = NOW()
    state.visibleSince ??= now
    this.scheduleFireIfDue(state, now)
  }

  private finalizeDroppedState(state: ElementState): void {
    this.sourceController.remove(state)
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
