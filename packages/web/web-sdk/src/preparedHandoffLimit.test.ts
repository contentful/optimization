import { signals } from '@contentful/optimization-core'
import type { ExperienceEventArray } from '@contentful/optimization-core/api-schemas'
import ContentfulOptimization from './ContentfulOptimization'

describe('browser prepared handoff limit', () => {
  it('rejects 101 events before queue admission even when queue capacity is larger', async () => {
    signals.online.value = true
    signals.profile.value = undefined
    const sdk = new ContentfulOptimization({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true },
      queuePolicy: { offlineMaxEvents: 150 },
    })
    try {
      const upsert = rs.spyOn(sdk.api.experience, 'upsertProfile')
      const ordinaryPage = rs.spyOn(sdk, 'page')
      const events: ExperienceEventArray = [
        ...Array.from({ length: 100 }, () => sdk.eventBuilder.buildTrack({ event: 'campaign' })),
        sdk.eventBuilder.buildPageView(),
      ]

      await expect(
        sdk.hydrateAndTrackCurrentPage(
          {
            cache: { scope: 'private-request' },
            replay: { routeKey: '/products', events },
          },
          { routeKey: '/products' },
        ),
      ).resolves.toEqual({ accepted: false })
      expect(upsert).not.toHaveBeenCalled()
      expect(ordinaryPage).not.toHaveBeenCalled()
    } finally {
      sdk.destroy()
      rs.restoreAllMocks()
    }
  })
})
