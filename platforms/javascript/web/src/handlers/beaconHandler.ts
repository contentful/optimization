import type { BatchInsightsEventArray } from '@contentful/optimization-core'

/**
 * Send a batch of analytics events using `navigator.sendBeacon`.
 *
 * @param url - The endpoint URL to which the beacon request should be sent.
 * @param events - The batch of events to serialize and send.
 * @returns `true` if the user agent successfully queued the data for transfer,
 * otherwise `false`.
 *
 * @public
 * @remarks
 * This is intended for fire-and-forget flushing of analytics events during
 * lifecycle transitions (e.g., page unload or visibility change).
 *
 * @example
 * ```ts
 * const ok = beaconHandler('/analytics/batch', batchEvents)
 * if (!ok) {
 *   // Optionally fall back to XHR/fetch
 * }
 * ```
 */
export function beaconHandler(url: string | URL, events: BatchInsightsEventArray): boolean {
  const blobData = new Blob([JSON.stringify(events)], {
    type: 'text/plain',
  })

  return window.navigator.sendBeacon(url, blobData)
}
