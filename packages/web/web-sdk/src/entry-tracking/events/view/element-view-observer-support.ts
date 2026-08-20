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
  readonly root?: Element | Document | null
  readonly rootMargin?: string
}

export interface ElementViewElementOptions {
  readonly data?: unknown
}

export type EffectiveObserverOptions = Required<ElementViewObserverOptions>

export type ElementViewSource = 'element' | 'virtual'

export interface ElementState {
  ref: WeakRef<Element> | null
  strongRef: Element | null
  source: ElementViewSource
  target: Element | null
  data?: unknown
  accumulatedMs: number
  visibleSince: number | null
  fireTimer: Timer | null
  attempts: number
  viewId: string | null
  done: boolean
  lastKnownVisible: boolean
  callbackChain: Promise<void> | null
}

export const initElementViewObserverOptions = (
  options?: ElementViewObserverOptions,
): EffectiveObserverOptions => ({
  root: options?.root ?? null,
  rootMargin: options?.rootMargin ?? '0px',
})

export const createElementState = (
  element: Element,
  elementOptions?: ElementViewElementOptions,
): ElementState => {
  const hasWeakRef = typeof WeakRef === 'function'

  return {
    ref: hasWeakRef ? new WeakRef(element) : null,
    strongRef: hasWeakRef ? null : element,
    source: 'element',
    target: null,
    data: elementOptions?.data,
    accumulatedMs: 0,
    visibleSince: null,
    fireTimer: null,
    attempts: 0,
    viewId: null,
    done: false,
    lastKnownVisible: false,
    callbackChain: null,
  }
}
