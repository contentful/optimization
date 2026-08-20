/**
 * Lean IntersectionObserver-based dwell tracker for entry views.
 *
 * Behavior:
 * - Fires one start callback after the dwell threshold
 * - Emits one final view-duration callback when a qualified view ends
 * - Ends view sessions when the page is hidden and starts a fresh session on return
 * - Serializes start and final callbacks per element
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
  initElementViewObserverOptions,
  isPageVisible,
} from './element-view-observer-support'
import ElementViewSourceController from './elementViewSourceController'

const logger = createScopedLogger('Web:ElementViewObserver')
const createViewId = (): string => crypto.randomUUID()

/**
 * Observe elements with `IntersectionObserver` and invoke a start callback once
 * dwell is satisfied, then one final callback when the qualified view ends.
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
  private readonly pendingCallbacks = new Set<Promise<void>>()
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
        threshold: [0, DEFAULTS.RATIO],
      },
    )
    this.sourceController = new ElementViewSourceController(this.io, this.opts, {
      onDropped: this.finalizeDroppedState.bind(this),
      onHidden: this.onVisibilityEnd.bind(this),
      onVisible: this.onIntersecting.bind(this),
      sweep: this.sweepOrphans.bind(this),
    })

    this.cleanupVisibilityListener = addVisibilityChangeListener((isVisible) => {
      this.onPageVisibilityChange(isVisible)
    })
  }

  public observe(element: Element, options?: ElementViewElementOptions): void {
    let state = this.states.get(element)

    if (!state) {
      state = createElementState(element, options)
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

  public async endActive(): Promise<void> {
    const now = NOW()

    for (const state of this.activeStates) {
      this.endVisibilitySession(state, now)
    }

    await Promise.all(this.pendingCallbacks)
  }

  private onPageVisibilityChange(isVisible: boolean): void {
    const now = NOW()

    for (const state of this.activeStates) {
      if (state.done) continue

      if (isVisible) {
        this.startVisibilitySession(state, now)
      } else {
        this.endVisibilitySession(state, now)
      }
    }

    if (isVisible) this.sourceController.requestVirtualMeasurement()

    this.sweepOrphans()
  }

  private onIntersect(entries: readonly IntersectionObserverEntry[]): void {
    const now = NOW()

    for (const entry of entries) {
      const states = this.sourceController.getStatesForTarget(entry.target)

      if (!states) continue

      for (const state of states) {
        if (state.done) continue

        const intersectsThreshold =
          entry.isIntersecting && entry.intersectionRatio >= DEFAULTS.RATIO

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
    state.lastKnownVisible = true

    this.startVisibilitySession(state, now)
  }

  private onVisibilityEnd(state: ElementState, now: number): void {
    if (!state.lastKnownVisible) return

    state.lastKnownVisible = false
    this.endVisibilitySession(state, now)
  }

  private startVisibilitySession(state: ElementState, now: number): void {
    if (state.done || !state.lastKnownVisible || !isPageVisible() || state.viewId !== null) {
      return
    }

    state.accumulatedMs = 0
    state.attempts = 0
    state.viewId = createViewId()
    state.visibleSince = now
    clearFireTimer(state)
    this.scheduleQualification(state)
  }

  private static resetVisibilitySession(state: ElementState): void {
    state.accumulatedMs = 0
    state.visibleSince = null
    state.attempts = 0
    state.viewId = null
    clearFireTimer(state)
  }

  private scheduleQualification(state: ElementState): void {
    if (
      state.done ||
      state.fireTimer !== null ||
      !state.lastKnownVisible ||
      !isPageVisible() ||
      state.viewId === null
    ) {
      return
    }

    state.fireTimer = setTimeout(() => {
      if (
        state.done ||
        !state.lastKnownVisible ||
        !isPageVisible() ||
        state.visibleSince === null ||
        state.viewId === null
      ) {
        clearFireTimer(state)
        return
      }

      this.qualify(state, NOW())
    }, DEFAULTS.DWELL_MS)
  }

  private qualify(state: ElementState, now: number): void {
    if (state.done || state.viewId === null || state.visibleSince === null) return

    clearFireTimer(state)
    state.attempts = 1
    state.accumulatedMs = Math.max(0, now - state.visibleSince)
    void this.queueCallback(state, state.viewId, state.accumulatedMs, state.attempts)
  }

  private endVisibilitySession(state: ElementState, now: number): void {
    if (state.done || state.viewId === null) return

    if (state.visibleSince !== null) {
      state.accumulatedMs = Math.max(state.accumulatedMs, now - state.visibleSince)
    }

    const { viewId, accumulatedMs: totalVisibleMs } = state
    const qualified = state.attempts > 0

    ElementViewObserver.resetVisibilitySession(state)

    if (qualified) {
      void this.queueCallback(state, viewId, totalVisibleMs, 2)
    }
  }

  private async queueCallback(
    state: ElementState,
    viewId: string,
    totalVisibleMs: number,
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
            totalVisibleMs,
            viewId,
            attempts,
            data,
          }),
        (error) => {
          logger.error('Error in element view callback:', error)
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
