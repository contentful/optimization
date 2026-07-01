import {
  getRemainingMsUntilNextEntryViewFire,
  resolveEntryViewTimingOptions,
} from '@contentful/optimization-core'
import {
  type Interval,
  NOW,
  type Timer,
  clearFireTimer,
  derefElement,
  isPageVisible,
} from '../observerSupport'

export { NOW, clearFireTimer, derefElement, isPageVisible, type Interval, type Timer }

export const DEFAULTS = {
  DWELL_MS: 1000,
  VIEW_DURATION_UPDATE_INTERVAL_MS: 5000,
  RATIO: 0.1,
  SWEEP_INTERVAL_MS: 30000,
} as const

export interface ElementViewCallbackInfo {
  readonly totalVisibleMs: number
  readonly viewId: string
  readonly attempts: number
  readonly data?: unknown
}

export type ElementViewCallback = (
  element: Element,
  info: ElementViewCallbackInfo,
) => void | Promise<void>

export interface ElementViewObserverOptions {
  readonly dwellTimeMs?: number
  readonly viewDurationUpdateIntervalMs?: number
  readonly minVisibleRatio?: number
  readonly root?: Element | Document | null
  readonly rootMargin?: string
}

export interface ElementViewElementOptions {
  readonly dwellTimeMs?: number
  readonly viewDurationUpdateIntervalMs?: number
  readonly data?: unknown
}

export type EffectiveObserverOptions = Required<
  Pick<
    ElementViewObserverOptions,
    'dwellTimeMs' | 'viewDurationUpdateIntervalMs' | 'minVisibleRatio' | 'root' | 'rootMargin'
  >
>

export type PerElementEffectiveOptions = Required<
  Pick<EffectiveObserverOptions, 'dwellTimeMs' | 'viewDurationUpdateIntervalMs'>
>

export type ElementViewSource = 'element' | 'virtual'

export interface ElementState {
  ref: WeakRef<Element> | null
  strongRef: Element | null
  source: ElementViewSource
  target: Element | null
  opts: PerElementEffectiveOptions
  data?: unknown
  accumulatedMs: number
  visibleSince: number | null
  fireTimer: Timer | null
  attempts: number
  viewId: string | null
  done: boolean
  inFlight: boolean
  lastKnownVisible: boolean
  pendingFinal: boolean
}

export const initElementViewObserverOptions = (
  options?: ElementViewObserverOptions,
): EffectiveObserverOptions => ({
  ...resolveEntryViewTimingOptions(options, {
    dwellTimeMs: DEFAULTS.DWELL_MS,
    viewDurationUpdateIntervalMs: DEFAULTS.VIEW_DURATION_UPDATE_INTERVAL_MS,
    minVisibleRatio: DEFAULTS.RATIO,
  }),
  root: options?.root ?? null,
  rootMargin: options?.rootMargin ?? '0px',
})

export const createElementState = (
  element: Element,
  observerOptions: EffectiveObserverOptions,
  elementOptions?: ElementViewElementOptions,
): ElementState => {
  const { dwellTimeMs, viewDurationUpdateIntervalMs } = resolveEntryViewTimingOptions(
    elementOptions,
    observerOptions,
  )
  const opts: PerElementEffectiveOptions = { dwellTimeMs, viewDurationUpdateIntervalMs }

  const hasWeakRef = typeof WeakRef === 'function'

  return {
    ref: hasWeakRef ? new WeakRef(element) : null,
    strongRef: hasWeakRef ? null : element,
    source: 'element',
    target: null,
    opts,
    data: elementOptions?.data,
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

export const pauseVisibilityCycle = (state: ElementState, now: number): void => {
  if (!state.lastKnownVisible) return

  if (state.visibleSince !== null) {
    state.accumulatedMs += now - state.visibleSince
    state.visibleSince = null
  }

  clearFireTimer(state)
}

export const resetVisibilityCycle = (state: ElementState): void => {
  state.lastKnownVisible = false
  state.pendingFinal = false
  state.accumulatedMs = 0
  state.visibleSince = null
  state.attempts = 0
  state.viewId = null
  clearFireTimer(state)
}

export const getRemainingMsUntilNextFire = (state: ElementState, elapsedMs: number): number =>
  getRemainingMsUntilNextEntryViewFire({
    ...state.opts,
    attempts: state.attempts,
    accumulatedMs: elapsedMs,
  })
