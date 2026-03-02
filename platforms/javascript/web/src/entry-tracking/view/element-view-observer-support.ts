/**
 * Shared types, tunables, environment helpers, and state utilities for
 * {@link ElementViewObserver}.
 *
 * @internal
 */

import { CAN_ADD_LISTENERS } from '../../constants'

/**
 * Timer handle type returned by `setTimeout`.
 *
 * @public
 */
export type Timer = ReturnType<typeof setTimeout>

/**
 * Interval handle type returned by `setInterval`.
 *
 * @public
 */
export type Interval = ReturnType<typeof setInterval>

/**
 * Get a high-resolution timestamp when available.
 *
 * @returns A timestamp in milliseconds since an arbitrary origin.
 *
 * @example
 * ```ts
 * const start = NOW()
 * ```
 *
 * @public
 */
export const NOW = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/**
 * Determine whether the current page is visible.
 *
 * @returns `true` if the page is visible or no document is available, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isPageVisible()) {
 *   scheduleCallback()
 * }
 * ```
 *
 * @public
 */
export const isPageVisible = (): boolean =>
  !CAN_ADD_LISTENERS ? true : document.visibilityState === 'visible'

/** ---- Tunables ---- */

/**
 * Default tuning values for {@link ElementViewObserver}.
 *
 * @public
 */
export const DEFAULTS = {
  /** Default dwell time in ms before firing. */
  DWELL_MS: 1000,
  /** Default view-duration update interval in ms after dwell has fired. */
  VIEW_DURATION_UPDATE_INTERVAL_MS: 5000,
  /** Default minimum intersection ratio considered visible. */
  RATIO: 0.1,
  /** Interval for sweeping orphaned states in ms. */
  SWEEP_INTERVAL_MS: 30000,
} as const

/** ---- Public Types ---- */

/**
 * Information passed to the element view callback.
 *
 * @public
 */
export interface ElementViewCallbackInfo {
  /** Total number of milliseconds the element has been visible. */
  readonly totalVisibleMs: number
  /** UUID identifying the active view session for the observed element. */
  readonly componentViewId: string
  /** How many attempts have been made (including the current one). */
  readonly attempts: number
  /** Optional user data associated with the element. */
  readonly data?: unknown
}

/**
 * Callback invoked after dwell is met and on periodic duration updates while visible.
 *
 * @public
 */
export type ElementViewCallback = (
  element: Element,
  info: ElementViewCallbackInfo,
) => void | Promise<void>

/**
 * Observer-level options that apply to all observed elements.
 *
 * @public
 */
export interface ElementViewObserverOptions {
  /** Required visible time (in ms) before the callback is fired. */
  readonly dwellTimeMs?: number
  /** Interval (in ms) for view-duration callback updates after dwell fires. */
  readonly viewDurationUpdateIntervalMs?: number
  /** Minimum intersection ratio (0-1) considered visible. */
  readonly minVisibleRatio?: number
  /** IntersectionObserver root. Default: null (viewport). */
  readonly root?: Element | Document | null
  /** IntersectionObserver rootMargin. Default: `"0px"`. */
  readonly rootMargin?: string
}

/**
 * Per-element overrides and data passed to the callback.
 *
 * @public
 */
export interface ElementViewElementOptions {
  /** Per-element dwell time override in ms. */
  readonly dwellTimeMs?: number
  /** Per-element override of view-duration update interval in ms. */
  readonly viewDurationUpdateIntervalMs?: number
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
 *
 * @internal
 */
export type EffectiveObserverOptions = Required<
  Pick<
    ElementViewObserverOptions,
    'dwellTimeMs' | 'viewDurationUpdateIntervalMs' | 'minVisibleRatio' | 'root' | 'rootMargin'
  >
>

/**
 * Fully-resolved per-element overrides used internally.
 *
 * @internal
 */
export type PerElementEffectiveOptions = Required<
  Pick<EffectiveObserverOptions, 'dwellTimeMs' | 'viewDurationUpdateIntervalMs'>
>

/**
 * Internal per-element state tracked by the observer.
 *
 * @internal
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
  /** Number of attempts performed so far. */
  attempts: number
  /** UUID identifying the active view session while visible. */
  componentViewId: string | null
  /** True once the callback attempt has settled for this element. */
  done: boolean
  /** True while a callback attempt is in flight. */
  inFlight: boolean
  /** Last known visibility state for the element. */
  lastKnownVisible: boolean
}

/**
 * Small numeric sanitizers.
 *
 * @public
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
}

/**
 * Clear a scheduled fire timer, if present.
 *
 * @param state - Element state whose fire timer should be cleared.
 * @returns Nothing.
 *
 * @public
 */
export const clearFireTimer = (state: ElementState): void => {
  if (state.fireTimer !== null) {
    clearTimeout(state.fireTimer)
    state.fireTimer = null
  }
}

/**
 * Dereference the element, honoring WeakRef when available.
 *
 * @param state - Element state containing refs.
 * @returns The underlying element or `null` if no longer available.
 *
 * @public
 */
export const derefElement = (state: ElementState): Element | null => {
  if (state.ref && typeof state.ref.deref === 'function') {
    const element = state.ref.deref()
    if (element) return element
  }
  return state.strongRef ?? null
}
