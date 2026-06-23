import { toRatio } from '../lib/number'

/**
 * Entry-view timing values shared by SDK view trackers.
 *
 * @public
 */
export interface EntryViewTiming {
  /** Required visible time in milliseconds before the first event fires. */
  dwellTimeMs: number
  /** Interval in milliseconds for subsequent duration updates. */
  viewDurationUpdateIntervalMs: number
  /** Minimum visible ratio in the `[0, 1]` interval. */
  minVisibleRatio: number
}

/**
 * Optional entry-view timing overrides.
 *
 * @public
 */
export type EntryViewTimingOptions = Partial<EntryViewTiming>

/**
 * Inputs for computing the remaining delay before the next entry-view event.
 *
 * @public
 */
export interface EntryViewFireSchedule {
  /** Required visible time in milliseconds before the first event fires. */
  dwellTimeMs: number
  /** Interval in milliseconds for subsequent duration updates. */
  viewDurationUpdateIntervalMs: number
  /** Number of entry-view event attempts already made in this visibility cycle. */
  attempts: number
  /** Accumulated visible time in milliseconds for this visibility cycle. */
  accumulatedMs: number
}

const toNonNegativeNumber = (value: number | undefined, fallback: number): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback

  return Math.max(0, value)
}

/**
 * Resolve entry-view timing with platform-specific defaults.
 *
 * @param options - Optional timing overrides.
 * @param defaults - Platform defaults to use for omitted or invalid values.
 * @returns Normalized timing values.
 *
 * @public
 */
export function resolveEntryViewTimingOptions(
  options: EntryViewTimingOptions | undefined,
  defaults: EntryViewTiming,
): EntryViewTiming {
  return {
    dwellTimeMs: toNonNegativeNumber(options?.dwellTimeMs, defaults.dwellTimeMs),
    viewDurationUpdateIntervalMs: toNonNegativeNumber(
      options?.viewDurationUpdateIntervalMs,
      defaults.viewDurationUpdateIntervalMs,
    ),
    minVisibleRatio: toRatio(options?.minVisibleRatio, defaults.minVisibleRatio),
  }
}

/**
 * Compute remaining milliseconds before the next entry-view event should fire.
 *
 * @param schedule - Current timing and visibility-cycle state.
 * @returns Remaining delay. Values less than or equal to zero mean fire now.
 *
 * @public
 */
export function getRemainingMsUntilNextEntryViewFire({
  dwellTimeMs,
  viewDurationUpdateIntervalMs,
  attempts,
  accumulatedMs,
}: EntryViewFireSchedule): number {
  return dwellTimeMs + attempts * viewDurationUpdateIntervalMs - accumulatedMs
}

/**
 * Decide whether an entry-view event should request sticky assignment.
 *
 * @param sticky - Sticky value from resolved tracking metadata.
 * @param alreadyAccepted - Whether the rendered entry already accepted a sticky event.
 * @returns `true` when the SDK should include `sticky: true`.
 *
 * @public
 */
export const shouldSendStickyEntryView = (
  sticky: boolean | undefined,
  alreadyAccepted: boolean,
): boolean => sticky === true && !alreadyAccepted

/**
 * Decide whether a sticky entry-view result should be remembered by the runtime.
 *
 * @param stickySent - Whether the event included `sticky: true`.
 * @param accepted - Whether the event was accepted by Core.
 * @returns `true` when platform-local sticky state should record success.
 *
 * @public
 */
export const shouldRememberStickyEntryViewResult = (
  stickySent: boolean,
  accepted: boolean,
): boolean => stickySent && accepted
