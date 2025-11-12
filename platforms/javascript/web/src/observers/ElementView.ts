/**
 * Shared types, tunables, environment helpers, and state utilities for ElementViewObserver.
 */

export type Timer = ReturnType<typeof setTimeout>
export type Interval = ReturnType<typeof setInterval>

export const HAS_DOC =
  typeof document !== 'undefined' && typeof document.addEventListener === 'function'

/** High-resolution time when available. */
export const NOW = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/** Page visibility helper (true when no document is available). */
export const isPageVisible = (): boolean =>
  !HAS_DOC ? true : document.visibilityState === 'visible'

/** ---- Tunables ---- */
export const DEFAULTS = {
  DWELL_MS: 1000,
  RATIO: 0.1,
  MAX_RETRIES: 2,
  BACKOFF_MS: 300,
  MULTIPLIER: 2,
  JITTER_DIVISOR: 2,
  SWEEP_INTERVAL_MS: 30000,
} as const

/** Adds small random jitter to a base delay to prevent thundering herds. */
export const withJitter = (base: number): number =>
  base + Math.floor(Math.random() * Math.max(1, Math.floor(base / DEFAULTS.JITTER_DIVISOR)))

/** ---- Public Types ---- */
export interface ElementViewCallbackInfo {
  readonly totalVisibleMs: number
  readonly attempts: number
  readonly data?: unknown
}

/** Callback invoked once per element after the dwell requirement is met, with retries on failure. */
export type ElementViewCallback = (
  element: Element,
  info: ElementViewCallbackInfo,
) => void | Promise<void>

/** Observer-level options. */
export interface ElementViewOptions {
  /** Required time before firing. */
  readonly dwellTimeMs?: number
  /** Minimum intersection ratio considered "visible". */
  readonly minVisibleRatio?: number
  /** IntersectionObserver root. Default: null (viewport). */
  readonly root?: Element | Document | null
  /** IntersectionObserver rootMargin. Default: "0px". */
  readonly rootMargin?: string
  /** Max callback retry attempts on failure. */
  readonly maxRetries?: number
  /** Initial backoff delay in ms for retries. */
  readonly retryBackoffMs?: number
  /** Exponential backoff multiplier. */
  readonly backoffMultiplier?: number
}

/** Per-element overrides and data passed to the callback. */
export interface ElementViewElementOptions {
  /** Per-element dwell time override. */
  readonly dwellTimeMs?: number
  /** Per-element retry parameters (all optional). */
  readonly maxRetries?: number
  readonly retryBackoffMs?: number
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
export type EffectiveOptions = Required<
  Pick<
    ElementViewOptions,
    | 'dwellTimeMs'
    | 'minVisibleRatio'
    | 'root'
    | 'rootMargin'
    | 'maxRetries'
    | 'retryBackoffMs'
    | 'backoffMultiplier'
  >
>

export type PerElementEffectiveOptions = Required<
  Pick<EffectiveOptions, 'dwellTimeMs' | 'maxRetries' | 'retryBackoffMs' | 'backoffMultiplier'>
>

/** Internal per-element state tracked by the observer. */
export interface ElementState {
  /** WeakRef path (modern browsers). */
  ref: WeakRef<Element> | null
  /** Strong reference fallback if WeakRef is unavailable. */
  strongRef: Element | null
  opts: PerElementEffectiveOptions
  data?: unknown
  accumulatedMs: number
  visibleSince: number | null
  fireTimer: Timer | null
  retryTimer: Timer | null
  retryScheduledAt: number | null
  retryDelayMs: number | null
  pendingRetry: boolean
  attempts: number
  done: boolean
  inFlight: boolean
  lastKnownVisible: boolean
}

/** Small numeric sanitizers. */
export const Num = {
  n: (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback),
  clamp01: (value: number | undefined, fallback: number): number =>
    Math.min(1, Math.max(0, Num.n(value, fallback))),
  nonNeg: (value: number | undefined, fallback: number): number =>
    Math.max(0, Num.n(value, fallback)),
  atLeast1: (value: number | undefined, fallback: number): number =>
    Math.max(1, Num.n(value, fallback)),
}

/** Clear a scheduled fire timer, if present. */
export const clearFireTimer = (state: ElementState): void => {
  if (state.fireTimer !== null) {
    clearTimeout(state.fireTimer)
    state.fireTimer = null
  }
}

/** Cancel a scheduled retry timer, if present. */
export const cancelRetry = (state: ElementState): void => {
  if (state.retryTimer !== null) {
    clearTimeout(state.retryTimer)
    state.retryTimer = null
  }
  state.retryScheduledAt = null
}

/** Dereference the element, honoring WeakRef when available. */
export const derefElement = (state: ElementState): Element | null => {
  if (state.ref && typeof state.ref.deref === 'function') {
    const element = state.ref.deref()
    if (element) return element
  }
  return state.strongRef ?? null
}
