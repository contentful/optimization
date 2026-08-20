/**
 * Lean hover dwell tracker for entry hovers.
 *
 * Behavior:
 * - Fires one start callback after the dwell threshold.
 * - Emits one final hover-duration callback when a qualified hover ends.
 * - Ends hover sessions when the page is hidden and requires a fresh pointer entry.
 * - Serializes start and final callbacks per element.
 * - Sweeps orphan/disconnected element state to avoid leaks.
 */

import { createScopedLogger } from '@contentful/optimization-core/logger'
import { CAN_ADD_LISTENERS } from '../../../constants'
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
  type ElementHoverCallback,
  type ElementHoverElementOptions,
  type ElementState,
  type Interval,
  NOW,
  clearFireTimer,
  derefElement,
  isPageVisible,
} from './element-hover-observer-support'

const logger = createScopedLogger('Web:ElementHoverObserver')
const createHoverId = (): string => crypto.randomUUID()

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
 * Observe elements and invoke a start callback once hover dwell is satisfied,
 * then one final callback when the qualified hover ends.
 *
 * @public
 */
class ElementHoverObserver {
  private readonly callback: ElementHoverCallback
  private readonly states = new WeakMap<Element, ElementState>()
  private readonly activeStates = new Set<ElementState>()
  private readonly pendingCallbacks = new Set<Promise<void>>()
  private cleanupVisibilityListener?: () => void
  private sweepInterval: Interval | null = null

  public constructor(callback: ElementHoverCallback) {
    this.callback = callback

    this.cleanupVisibilityListener = addVisibilityChangeListener((isVisible) => {
      this.onPageVisibilityChange(isVisible)
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

  public async endActive(): Promise<void> {
    const now = NOW()

    for (const state of this.activeStates) {
      this.endHoverCycle(state, now)
    }

    await Promise.all(this.pendingCallbacks)
  }

  private createState(element: Element, options?: ElementHoverElementOptions): ElementState {
    const hasWeakRef = typeof WeakRef === 'function'

    const state: ElementState = {
      ref: hasWeakRef ? new WeakRef(element) : null,
      strongRef: hasWeakRef ? null : element,
      data: options?.data,
      accumulatedMs: 0,
      hoverSince: null,
      fireTimer: null,
      attempts: 0,
      hoverId: null,
      done: false,
      isHovered: false,
      callbackChain: null,
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
    if (state.done || state.isHovered || !isNaturalHoverEvent(event) || !isPageVisible()) {
      return
    }

    const now = NOW()
    state.isHovered = true
    state.accumulatedMs = 0
    state.attempts = 0
    state.hoverId = createHoverId()
    state.hoverSince = now
    clearFireTimer(state)
    this.scheduleQualification(state)
  }

  private onHoverEnd(state: ElementState, event: Event): void {
    if (state.done || !state.isHovered || !isNaturalHoverEvent(event)) return

    this.endHoverCycle(state, NOW())
  }

  private onPageVisibilityChange(isVisible: boolean): void {
    if (!isVisible) {
      const now = NOW()
      for (const state of this.activeStates) {
        this.endHoverCycle(state, now)
      }
    }

    this.sweepOrphans()
  }

  private static resetHoverCycle(state: ElementState): void {
    state.isHovered = false
    state.accumulatedMs = 0
    state.hoverSince = null
    state.attempts = 0
    state.hoverId = null
    clearFireTimer(state)
  }

  private scheduleQualification(state: ElementState): void {
    if (
      state.done ||
      state.fireTimer !== null ||
      !state.isHovered ||
      !isPageVisible() ||
      state.hoverId === null
    ) {
      return
    }

    state.fireTimer = setTimeout(() => {
      if (
        state.done ||
        !state.isHovered ||
        !isPageVisible() ||
        state.hoverSince === null ||
        state.hoverId === null
      ) {
        clearFireTimer(state)
        return
      }

      this.qualify(state, NOW())
    }, DEFAULTS.DWELL_MS)
  }

  private qualify(state: ElementState, now: number): void {
    if (state.done || !state.isHovered || state.hoverId === null || state.hoverSince === null)
      return

    clearFireTimer(state)
    state.attempts = 1
    state.accumulatedMs = Math.max(0, now - state.hoverSince)
    void this.queueCallback(state, state.hoverId, state.accumulatedMs, state.attempts)
  }

  private endHoverCycle(state: ElementState, now: number): void {
    if (state.done || !state.isHovered || state.hoverId === null) return

    if (state.hoverSince !== null) {
      state.accumulatedMs = Math.max(state.accumulatedMs, now - state.hoverSince)
    }

    const { hoverId } = state
    const { accumulatedMs: totalHoverMs } = state
    const qualified = state.attempts > 0

    clearFireTimer(state)
    ElementHoverObserver.resetHoverCycle(state)

    if (qualified) {
      void this.queueCallback(state, hoverId, totalHoverMs, 2)
    }
  }

  private async queueCallback(
    state: ElementState,
    hoverId: string,
    totalHoverMs: number,
    attempts: number,
  ): Promise<void> {
    const element = derefElement(state)
    if (!element) {
      this.finalizeDroppedState(state)
      return
    }

    const { data } = state
    const invoke = async (): Promise<void> => {
      await safeCallAsync(
        (): void | Promise<void> =>
          this.callback(element, {
            totalHoverMs,
            hoverId,
            attempts,
            data,
          }),
        (error) => {
          logger.error('Error in element hover callback:', error)
        },
      )
    }
    const pending = state.callbackChain ? state.callbackChain.then(invoke) : invoke()

    state.callbackChain = pending
    this.pendingCallbacks.add(pending)
    void pending.then(() => {
      if (state.callbackChain === pending) state.callbackChain = null
      this.pendingCallbacks.delete(pending)
    })

    await pending
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
