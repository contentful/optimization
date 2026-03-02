/**
 * Per-element options for click interaction tracking.
 */
export interface EntryClickInteractionElementOptions {
  /**
   * Entry metadata to use for clicks on this element.
   *
   * @remarks
   * When present and valid, this value takes precedence over `data-ctfl-*`
   * dataset attributes on the element.
   */
  readonly data?: unknown
}

/**
 * Start options for automatic entry view tracking.
 */
export interface EntryViewInteractionStartOptions {
  /** Required visible time (in ms) before the callback is fired. */
  readonly dwellTimeMs?: number
  /** Interval (in ms) for emitting updated view-duration events while visible. */
  readonly viewDurationUpdateIntervalMs?: number
  /** Minimum intersection ratio (0-1) considered visible. */
  readonly minVisibleRatio?: number
  /** IntersectionObserver root. Default: null (viewport). */
  readonly root?: Element | Document | null
  /** IntersectionObserver rootMargin. Default: `"0px"`. */
  readonly rootMargin?: string
}

/**
 * Per-element options for view interaction tracking.
 */
export interface EntryViewInteractionElementOptions {
  /** Per-element dwell time override in ms. */
  readonly dwellTimeMs?: number
  /** Per-element override of view-duration update interval in ms. */
  readonly viewDurationUpdateIntervalMs?: number
  /** Arbitrary data to pass through to the callback for this element. */
  readonly data?: unknown
}

interface EntryInteractionStartOptionsMap {
  clicks: undefined
  views: EntryViewInteractionStartOptions | undefined
}

interface EntryInteractionElementOptionsMap {
  clicks: EntryClickInteractionElementOptions
  views: EntryViewInteractionElementOptions
}

/**
 * Minimal tracker contract for a tracked entry interaction.
 */
export interface EntryInteractionTracker<TStartOptions = never, TElementOptions = never> {
  start: (options?: TStartOptions) => void
  stop: () => void
  setAuto?: (enabled: boolean) => void
  enableElement?: (element: Element, options?: TElementOptions) => void
  disableElement?: (element: Element) => void
  clearElement?: (element: Element) => void
}

/**
 * Concrete tracked entry interaction registry for the Web SDK.
 */
export interface EntryInteractionTrackers {
  clicks: EntryInteractionTracker<
    EntryInteractionStartOptionsMap['clicks'],
    EntryInteractionElementOptionsMap['clicks']
  >
  views: EntryInteractionTracker<
    EntryInteractionStartOptionsMap['views'],
    EntryInteractionElementOptionsMap['views']
  >
}

/**
 * Union of tracked entry interaction keys.
 */
export type EntryInteraction = keyof EntryInteractionTrackers

/**
 * Auto-tracking configuration for tracked entry interactions.
 */
export type AutoTrackEntryInteractionOptions = Partial<Record<EntryInteraction, boolean>>

/**
 * Resolve a complete auto-tracking config object, applying defaults.
 *
 * @param options - Partial auto-tracking configuration.
 * @returns Resolved configuration for all known interactions.
 */
export function resolveAutoTrackEntryInteractionOptions(
  options?: AutoTrackEntryInteractionOptions,
): Record<EntryInteraction, boolean> {
  return {
    clicks: options?.clicks ?? false,
    views: options?.views ?? false,
  }
}

/**
 * Start options for a specific tracked entry interaction.
 */
export type EntryInteractionStartOptions<TInteraction extends EntryInteraction> =
  EntryInteractionStartOptionsMap[TInteraction]

/**
 * Interactions that support element-level observe/unobserve control.
 */
export type EntryElementInteraction = EntryInteraction

/**
 * Element options for a specific interaction.
 */
export type EntryInteractionElementOptions<TInteraction extends EntryElementInteraction> =
  EntryInteractionElementOptionsMap[TInteraction]

export interface EntryInteractionApi {
  enable: <TInteraction extends EntryInteraction>(
    interaction: TInteraction,
    options?: EntryInteractionStartOptions<TInteraction>,
  ) => void
  disable: (interaction: EntryInteraction) => void
  enableElement: <TInteraction extends EntryElementInteraction>(
    interaction: TInteraction,
    element: Element,
    options?: EntryInteractionElementOptions<TInteraction>,
  ) => void
  disableElement: (interaction: EntryElementInteraction, element: Element) => void
  clearElement: (interaction: EntryElementInteraction, element: Element) => void
}
