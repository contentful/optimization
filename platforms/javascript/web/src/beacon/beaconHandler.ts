import type { BatchInsightsEventArray } from '@contentful/optimization-core'

export function beaconHandler(url: string | URL, data: BatchInsightsEventArray): boolean {
  const blobData = new Blob([JSON.stringify(data)], {
    type: 'text/plain',
  })

  return window.navigator.sendBeacon(url, blobData)
}
