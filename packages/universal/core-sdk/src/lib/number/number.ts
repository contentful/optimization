/**
 * Normalize a candidate positive integer value with fallback.
 *
 * @param value - Incoming numeric value.
 * @param fallback - Fallback when value is invalid.
 * @returns Normalized positive integer.
 *
 * @internal
 */
export const toPositiveInt = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value) || value === undefined || value < 1) return fallback

  return Math.floor(value)
}

/**
 * Normalize a candidate ratio to the `[0, 1]` interval.
 *
 * @param value - Incoming ratio value.
 * @param fallback - Fallback when value is invalid.
 * @returns Normalized ratio.
 *
 * @internal
 */
export const toRatio = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value) || value === undefined) return fallback

  return Math.min(1, Math.max(0, value))
}
