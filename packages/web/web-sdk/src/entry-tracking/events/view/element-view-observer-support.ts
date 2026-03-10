import {
  type Interval,
  NOW,
  Num,
  type Timer,
  clearFireTimer,
  derefElement,
  isPageVisible,
} from '../observerSupport'

export { NOW, Num, clearFireTimer, derefElement, isPageVisible, type Interval, type Timer }

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

export interface ElementState {
  ref: WeakRef<Element> | null
  strongRef: Element | null
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
