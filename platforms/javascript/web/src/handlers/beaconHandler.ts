import type { BatchInsightsEventArray } from '@contentful/optimization-core'

export function beaconHandler(url: string | URL, events: BatchInsightsEventArray): boolean {
  const blobData = new Blob([JSON.stringify(events)], {
    type: 'text/plain',
  })

  return window.navigator.sendBeacon(url, blobData)
}
