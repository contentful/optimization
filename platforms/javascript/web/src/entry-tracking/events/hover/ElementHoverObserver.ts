/**
 * Lean hover dwell tracker for entry component hovers.
 *
 * Behavior:
 * - Fires callback after dwell threshold, then continues firing periodic
 *   duration updates while the same hover cycle remains active.
 * - Emits a final hover-duration callback when hover ends after first fire.
 * - Pauses/resumes dwell timers across page visibility changes.
 * - Coalesces concurrent callback attempts per element.
 * - Sweeps orphan/disconnected element state to avoid leaks.
 */

import { createScopedLogger } from '@contentful/optimization-core'
import { CAN_ADD_LISTENERS } from '../../../constants'
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
  type ElementHoverCallback,
  type ElementHoverElementOptions,
  type ElementHoverObserverOptions,
  type ElementState,
  type Interval,
  NOW,
  Num,
  type PerElementEffectiveOptions,
  clearFireTimer,
  derefElement,
  isPageVisible,
} from './element-hover-observer-support'

const logger = createScopedLogger('Web:ElementHoverObserver')
const createComponentHoverId = (): string => crypto.randomUUID()

const canUsePointerEvents = (): boolean =>
  CAN_ADD_LISTENERS &&
  typeof window !== 'undefined' &&
  typeof PointerEvent !== 'undefined' &&
  typeof window.PointerEvent === 'function'

const isNaturalHoverEvent = (event: Event): boolean => {
  if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
    return event.pointerType !== 'touch'
  }

  return true
}

/**
 * Observe elements and invoke a callback once hover dwell is satisfied, then
 * emit periodic duration updates while hovered.
 *
 * @public
 */
class ElementHoverObserver {
  private readonly callback: ElementHoverCallback
  private readonly opts: EffectiveObserverOptions
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private cleanupVisibilityListener?: () => void
  private sweepInterval: Interval | null = null

  public constructor(callback: ElementHoverCallback, options?: ElementHoverObserverOptions) {
    this.callback = callback
    this.opts = ElementHoverObserver.initOptions(options)

    this.cleanupVisibilityListener = addVisibilityChangeListener(() => {
      this.onPageVisibilityChange()
    })
  }

  public observe(element: Element, options?: ElementHoverElementOptions): void {
    const state = this.states.get(element)

    if (!state) {
      const nextState = this.createState(element, options)
      this.states.set(element, nextState)
      this.activeStates.add(nextState)
      ElementHoverObserver.attachHoverListeners(element, nextState)
      this.ensureSweeper()
      return
    }

    state.opts = ElementHoverObserver.resolvePerElementOptions(options, this.opts)
    state.data = options?.data
  }

  public unobserve(element: Element): void {
    const state = this.states.get(element)
    if (!state) return

    ElementHoverObserver.detachHoverListeners(element, state)
    clearFireTimer(state)
    state.done = true
    this.activeStates.delete(state)

    if (state.strongRef === element) state.strongRef = null

    this.states.delete(element)
    this.maybeStopSweeper()
  }

  public disconnect(): void {
    for (const state of this.activeStates) {
      const element = derefElement(state)
      if (element) ElementHoverObserver.detachHoverListeners(element, state)

      clearFireTimer(state)
      state.done = true
      state.strongRef = null
    }

    this.activeStates.clear()

    this.cleanupVisibilityListener?.()
    this.cleanupVisibilityListener = undefined

    this.stopSweeper()
  }

  private static initOptions(options?: ElementHoverObserverOptions): EffectiveObserverOptions {
    return {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, DEFAULTS.DWELL_MS),
      hoverDurationUpdateIntervalMs: Num.nonNeg(
        options?.hoverDurationUpdateIntervalMs,
        DEFAULTS.HOVER_DURATION_UPDATE_INTERVAL_MS,
      ),
    }
  }

  private static resolvePerElementOptions(
    options: ElementHoverElementOptions | undefined,
    observerOptions: EffectiveObserverOptions,
  ): PerElementEffectiveOptions {
    return {
      dwellTimeMs: Num.nonNeg(options?.dwellTimeMs, observerOptions.dwellTimeMs),
      hoverDurationUpdateIntervalMs: Num.nonNeg(
        options?.hoverDurationUpdateIntervalMs,
        observerOptions.hoverDurationUpdateIntervalMs,
      ),
    }
  }

  private createState(element: Element, options?: ElementHoverElementOptions): ElementState {
    const opts = ElementHoverObserver.resolvePerElementOptions(options, this.opts)
    const hasWeakRef = typeof WeakRef === 'function'

    const state: ElementState = {
      ref: hasWeakRef ? new WeakRef(element) : null,
      strongRef: hasWeakRef ? null : element,
      opts,
      data: options?.data,
      accumulatedMs: 0,
      hoverSince: null,
      fireTimer: null,
      attempts: 0,
      componentHoverId: null,
      done: false,
      inFlight: false,
      isHovered: false,
      pendingFinal: false,
      enterHandler: () => undefined,
      leaveHandler: () => undefined,
    }

    state.enterHandler = (event: Event): void => {
      this.onHoverStart(state, event)
    }
    state.leaveHandler = (event: Event): void => {
      this.onHoverEnd(state, event)
    }

    return state
  }

  private static attachHoverListeners(element: Element, state: ElementState): void {
    if (canUsePointerEvents()) {
      element.addEventListener('pointerenter', state.enterHandler)
      element.addEventListener('pointerleave', state.leaveHandler)
      element.addEventListener('pointercancel', state.leaveHandler)
      return
    }

    element.addEventListener('mouseenter', state.enterHandler)
    element.addEventListener('mouseleave', state.leaveHandler)
  }

  private static detachHoverListeners(element: Element, state: ElementState): void {
    if (canUsePointerEvents()) {
      element.removeEventListener('pointerenter', state.enterHandler)
      element.removeEventListener('pointerleave', state.leaveHandler)
      element.removeEventListener('pointercancel', state.leaveHandler)
      return
    }

    element.removeEventListener('mouseenter', state.enterHandler)
    element.removeEventListener('mouseleave', state.leaveHandler)
  }

  private onHoverStart(state: ElementState, event: Event): void {
    if (state.done || state.isHovered || !isNaturalHoverEvent(event)) return

    const now = NOW()
    state.isHovered = true
    state.pendingFinal = false
    state.accumulatedMs = 0
    state.attempts = 0
    state.componentHoverId = createComponentHoverId()
    state.hoverSince = isPageVisible() ? now : null
    clearFireTimer(state)

    if (state.hoverSince !== null) {
      this.scheduleFireIfDue(state, now)
    }
  }

  private onHoverEnd(state: ElementState, event: Event): void {
    if (state.done || !state.isHovered || !isNaturalHoverEvent(event)) return

    const now = NOW()
    if (state.hoverSince !== null) {
      state.accumulatedMs += now - state.hoverSince
      state.hoverSince = null
    }

    clearFireTimer(state)
    state.isHovered = false

    if (state.componentHoverId === null || state.attempts === 0) {
      ElementHoverObserver.resetHoverCycle(state)
      return
    }

    if (state.inFlight) {
      state.pendingFinal = true
      return
    }

    void this.attemptCallback(state, state.accumulatedMs)
  }

  private onPageVisibilityChange(): void {
    const now = NOW()
    const hidden = !isPageVisible()

    for (const state of this.activeStates) {
      if (state.done) continue

      if (hidden) {
        ElementHoverObserver.pauseHoverCycle(state, now)
      } else {
        this.resumeHoverCycle(state, now)
      }
    }

    this.sweepOrphans()
  }

  private static pauseHoverCycle(state: ElementState, now: number): void {
    if (!state.isHovered) return

    if (state.hoverSince !== null) {
      state.accumulatedMs += now - state.hoverSince
      state.hoverSince = null
    }

    clearFireTimer(state)
  }

  private resumeHoverCycle(state: ElementState, now: number): void {
    if (!state.isHovered || state.done || state.inFlight) return

    state.hoverSince ??= now
    this.scheduleFireIfDue(state, now)
  }

  private static resetHoverCycle(state: ElementState): void {
    state.isHovered = false
    state.pendingFinal = false
    state.accumulatedMs = 0
    state.hoverSince = null
    state.attempts = 0
    state.componentHoverId = null
    clearFireTimer(state)
  }

  private scheduleFireIfDue(state: ElementState, now: number): void {
    if (
      state.done ||
      state.inFlight ||
      state.fireTimer !== null ||
      !state.isHovered ||
      !isPageVisible() ||
      state.componentHoverId === null
    ) {
      return
    }

    const elapsed = state.accumulatedMs + (state.hoverSince !== null ? now - state.hoverSince : 0)
    const remaining = ElementHoverObserver.getRemainingMsUntilNextFire(state, elapsed)

    if (remaining <= 0) {
      this.trigger(state, now)
      return
    }

    state.fireTimer = setTimeout(() => {
      if (
        state.done ||
        state.inFlight ||
        !state.isHovered ||
        !isPageVisible() ||
        state.hoverSince === null
      ) {
        clearFireTimer(state)
        return
      }

      this.trigger(state, NOW())
    }, Math.ceil(remaining))
  }

  private trigger(state: ElementState, now: number): void {
    if (state.done || state.inFlight || state.componentHoverId === null) return

    if (state.hoverSince !== null) {
      state.accumulatedMs += now - state.hoverSince
      state.hoverSince = now
    }

    clearFireTimer(state)

    const { accumulatedMs: totalHoverMs } = state
    void this.attemptCallback(state, totalHoverMs)
  }

  private async attemptCallback(state: ElementState, totalHoverMs: number): Promise<void> {
    if (state.done || state.inFlight || state.componentHoverId === null) return

    const element = derefElement(state)
    if (!element) {
      this.finalizeDroppedState(state)
      return
    }

    state.inFlight = true
    state.attempts += 1
    const { componentHoverId } = state

    await safeCallAsync(
      (): void | Promise<void> =>
        this.callback(element, {
          totalHoverMs,
          componentHoverId,
          attempts: state.attempts,
          data: state.data,
        }),
      (error) => {
        logger.error('Error in element hover callback:', error)
      },
    )

    this.onAttemptSettled(state)
  }

  private onAttemptSettled(state: ElementState): void {
    state.inFlight = false

    if (state.done) return

    if (!state.isHovered) {
      if (state.pendingFinal && state.componentHoverId !== null) {
        state.pendingFinal = false
        void this.attemptCallback(state, state.accumulatedMs)
        return
      }

      ElementHoverObserver.resetHoverCycle(state)
      return
    }

    if (!isPageVisible()) return

    const now = NOW()
    state.hoverSince ??= now
    this.scheduleFireIfDue(state, now)
  }

  private static getRemainingMsUntilNextFire(state: ElementState, elapsedMs: number): number {
    const requiredElapsedMs =
      state.opts.dwellTimeMs + state.attempts * state.opts.hoverDurationUpdateIntervalMs

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

export default ElementHoverObserver
