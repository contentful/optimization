/**
 * Send a serialized analytics payload using `navigator.sendBeacon`.
 *
 * @param url - The endpoint URL that receives the beacon request.
 * @param body - Serialized event payload to send.
 * @returns `true` if the user agent successfully queued the data for transfer,
 * otherwise `false`.
 *
 * @remarks
 * This is intended for fire-and-forget flushing of analytics events during
 * lifecycle transitions (e.g., page unload or visibility change).
 *
 * @example
 * ```ts
 * const ok = beaconHandler('/analytics/batch', JSON.stringify(batchEvents))
 * if (!ok) {
 *   // Optionally fall back to XHR/fetch
 * }
 * ```
 *
 * @public
 */
export function beaconHandler(url: string, body: string): boolean {
  return window.navigator.sendBeacon(url, body)
}
