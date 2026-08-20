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
  HOVER_DURATION_UPDATE_INTERVAL_MS: 5000,
  SWEEP_INTERVAL_MS: 30000,
} as const

export interface ElementHoverCallbackInfo {
  readonly totalHoverMs: number
  readonly hoverId: string
  readonly attempts: number
  readonly data?: unknown
}

export type ElementHoverCallback = (
  element: Element,
  info: ElementHoverCallbackInfo,
) => void | Promise<void>

export interface ElementHoverElementOptions {
  readonly data?: unknown
}

export interface ElementState {
  ref: WeakRef<Element> | null
  strongRef: Element | null
  data?: unknown
  accumulatedMs: number
  hoverSince: number | null
  fireTimer: Timer | null
  attempts: number
  hoverId: string | null
  done: boolean
  inFlight: boolean
  isHovered: boolean
  pendingFinal: boolean
  enterHandler: (event: Event) => void
  leaveHandler: (event: Event) => void
}
