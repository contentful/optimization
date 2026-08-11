import type { TrackCurrentPageResult } from './index'
import { createWebSnapshotRuntime } from './runtime'

describe('createWebSnapshotRuntime', () => {
  it('reports current-page tracking as not allowed', async () => {
    const runtime = createWebSnapshotRuntime()
    const result: TrackCurrentPageResult = await runtime.trackCurrentPage({
      routeKey: '/',
      buildPayload: () => ({}),
    })

    expect(result).toEqual({ accepted: false, reason: 'not-allowed' })
  })
})
