/**
 * Shared types, tunables, environment helpers, and state utilities for ElementViewObserver.
 */

import { CAN_ADD_LISTENERS } from '../global-constants'

/**
 * Timer handle type returned by `setTimeout`.
 */
export type Timer = ReturnType<typeof setTimeout>

/**
 * Interval handle type returned by `setInterval`.
 */
export type Interval = ReturnType<typeof setInterval>

/**
 * Get a high-resolution timestamp when available.
 *
 * @returns A timestamp in milliseconds since an arbitrary origin.
 */
export const NOW = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/**
 * Determine whether the current page is visible.
 *
 * @returns `true` if the page is visible or no document is available, otherwise `false`.
 */
export const isPageVisible = (): boolean =>
  !CAN_ADD_LISTENERS ? true : document.visibilityState === 'visible'

/** ---- Tunables ---- */

/**
 * Default tuning values for {@link ElementViewObserver}.
 */
export const DEFAULTS = {
  /** Default dwell time in ms before firing. */
  DWELL_MS: 1000,
  /** Default minimum intersection ratio considered visible. */
  RATIO: 0.1,
  /** Default maximum retry attempts. */
  MAX_RETRIES: 2,
  /** Default initial backoff delay for retries in ms. */
  BACKOFF_MS: 300,
  /** Default exponential backoff multiplier. */
  MULTIPLIER: 2,
  /** Divisor used to compute jitter magnitude. */
  JITTER_DIVISOR: 2,
  /** Interval for sweeping orphaned states in ms. */
  SWEEP_INTERVAL_MS: 30000,
} as const

/**
 * Add small random jitter to a base delay to reduce thundering herd effects.
 *
 * @param base - Base delay in ms.
 * @returns Jittered delay in ms.
 */
export const withJitter = (base: number): number =>
  base + Math.floor(Math.random() * Math.max(1, Math.floor(base / DEFAULTS.JITTER_DIVISOR)))

/** ---- Public Types ---- */

/**
 * Information passed to the element view callback.
 */
export interface ElementViewCallbackInfo {
  /** Total number of milliseconds the element has been visible. */
  readonly totalVisibleMs: number
  /** How many attempts have been made (including the current one). */
  readonly attempts: number
  /** Optional user data associated with the element. */
  readonly data?: unknown
}

/**
 * Callback invoked once per element after the dwell requirement is met,
 * with retries on failure.
 */
export type ElementViewCallback = (
  element: Element,
  info: ElementViewCallbackInfo,
) => void | Promise<void>

/**
 * Observer-level options that apply to all observed elements.
 */
export interface ElementViewObserverOptions {
  /** Required visible time (in ms) before the callback is fired. */
  readonly dwellTimeMs?: number
  /** Minimum intersection ratio (0-1) considered visible. */
  readonly minVisibleRatio?: number
  /** IntersectionObserver root. Default: null (viewport). */
  readonly root?: Element | Document | null
  /** IntersectionObserver rootMargin. Default: `"0px"`. */
  readonly rootMargin?: string
  /** Max callback retry attempts on failure. */
  readonly maxRetries?: number
  /** Initial backoff delay in ms for retries. */
  readonly retryBackoffMs?: number
  /** Exponential backoff multiplier. */
  readonly backoffMultiplier?: number
}

/**
 * Per-element overrides and data passed to the callback.
 */
export interface ElementViewElementOptions {
  /** Per-element dwell time override in ms. */
  readonly dwellTimeMs?: number
  /** Per-element optional max callback retry attempts on failures. */
  readonly maxRetries?: number
  /** Per-element optional initial backoff delay in ms for retrie. */
  readonly retryBackoffMs?: number
  /** Per-element optional exponential backoff multiplier. */
  readonly backoffMultiplier?: number
  /** Arbitrary data to pass through to the callback for this element. */
  readonly data?: unknown
  /**
   * NOTE: minVisibleRatio is intentionally NOT supported per-element because
   * IntersectionObserver thresholds are configured per observer instance.
   * Use a separate observer if you need different ratio thresholds.
   */
}

/** ---- Effective internal option shapes ---- */

/**
 * Fully-resolved observer-level options used internally.
 */
export type EffectiveObserverOptions = Required<
  Pick<
    ElementViewObserverOptions,
    | 'dwellTimeMs'
    | 'minVisibleRatio'
    | 'root'
    | 'rootMargin'
    | 'maxRetries'
    | 'retryBackoffMs'
    | 'backoffMultiplier'
  >
>

/**
 * Fully-resolved per-element overrides used internally.
 */
export type PerElementEffectiveOptions = Required<
  Pick<
    EffectiveObserverOptions,
    'dwellTimeMs' | 'maxRetries' | 'retryBackoffMs' | 'backoffMultiplier'
  >
>

/**
 * Internal per-element state tracked by the observer.
 */
export interface ElementState {
  /** WeakRef path (modern browsers). */
  ref: WeakRef<Element> | null
  /** Strong reference fallback if WeakRef is unavailable. */
  strongRef: Element | null
  /** Effective per-element options. */
  opts: PerElementEffectiveOptions
  /** User data associated with the element. */
  data?: unknown
  /** Accumulated visible time in ms. */
  accumulatedMs: number
  /** Timestamp when the element became visible, or null if not currently visible. */
  visibleSince: number | null
  /** Timer handle for firing the callback after dwell time. */
  fireTimer: Timer | null
  /** Timer handle for scheduled retry. */
  retryTimer: Timer | null
  /** Timestamp when retry was scheduled. */
  retryScheduledAt: number | null
  /** Delay used for the current retry. */
  retryDelayMs: number | null
  /** True if a retry is pending but not yet scheduled. */
  pendingRetry: boolean
  /** Number of attempts performed so far. */
  attempts: number
  /** True once the callback has succeeded or retries are exhausted. */
  done: boolean
  /** True while a callback attempt is in flight. */
  inFlight: boolean
  /** Last known visibility state for the element. */
  lastKnownVisible: boolean
}

/**
 * Small numeric sanitizers.
 */
export const Num = {
  /** Use the provided number or fall back when the value is not numeric. */
  n: (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback),
  /** Clamp a value to the [0, 1] range. */
  clamp01: (value: number | undefined, fallback: number): number =>
    Math.min(1, Math.max(0, Num.n(value, fallback))),
  /** Ensure a non-negative value. */
  nonNeg: (value: number | undefined, fallback: number): number =>
    Math.max(0, Num.n(value, fallback)),
  /** Ensure a value of at least 1. */
  atLeast1: (value: number | undefined, fallback: number): number =>
    Math.max(1, Num.n(value, fallback)),
}

/**
 * Clear a scheduled fire timer, if present.
 *
 * @param state - Element state whose fire timer should be cleared.
 */
export const clearFireTimer = (state: ElementState): void => {
  if (state.fireTimer !== null) {
    clearTimeout(state.fireTimer)
    state.fireTimer = null
  }
}

/**
 * Cancel a scheduled retry timer, if present.
 *
 * @param state - Element state whose retry timer should be cleared.
 */
export const cancelRetry = (state: ElementState): void => {
  if (state.retryTimer !== null) {
    clearTimeout(state.retryTimer)
    state.retryTimer = null
  }
  state.retryScheduledAt = null
}

/**
 * Dereference the element, honoring WeakRef when available.
 *
 * @param state - Element state containing refs.
 * @returns The underlying element or `null` if no longer available.
 */
export const derefElement = (state: ElementState): Element | null => {
  if (state.ref && typeof state.ref.deref === 'function') {
    const element = state.ref.deref()
    if (element) return element
  }
  return state.strongRef ?? null
}
