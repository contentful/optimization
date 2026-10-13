import { signals } from '@contentful/optimization-core'
import type {
  ExperienceEventArray,
  OptimizationData,
} from '@contentful/optimization-core/api-schemas'
import ContentfulOptimization from './ContentfulOptimization'
import { ANONYMOUS_ID_COOKIE } from './constants'
import { removeCookie } from './lib/cookies'
import { deferred } from './test/helpers'

describe('browser prepared handoff limit', () => {
  it.each(['101 events', 'invalid schema', 'invalid order', '51 identifies'])(
    'falls back to an ordinary page for %s while retaining continuation identity',
    async (scenario) => {
      localStorage.clear()
      removeCookie(ANONYMOUS_ID_COOKIE)
      signals.online.value = true
      signals.profile.value = undefined
      const sdk = new ContentfulOptimization({
        spaceId: 'key_123',
        environment: 'main',
        defaults: { consent: true },
        queuePolicy: { offlineMaxEvents: 150 },
      })
      try {
        window.dispatchEvent(new Event('offline'))
        const response = deferred<OptimizationData>()
        const upsert = rs
          .spyOn(sdk.api.experience, 'upsertProfile')
          .mockReturnValue(response.promise)
        const ordinaryPage = rs.spyOn(sdk, 'page')
        let events: ExperienceEventArray = [
          ...Array.from({ length: 100 }, () => sdk.eventBuilder.buildTrack({ event: 'campaign' })),
          sdk.eventBuilder.buildPageView(),
        ]
        if (scenario === 'invalid schema')
          events = [
            { ...sdk.eventBuilder.buildTrack({ event: 'campaign' }), originalTimestamp: 'invalid' },
            sdk.eventBuilder.buildPageView(),
          ]
        if (scenario === 'invalid order')
          events = [sdk.eventBuilder.buildPageView(), sdk.eventBuilder.buildPageView()]
        if (scenario === '51 identifies')
          events = [
            ...Array.from({ length: 51 }, () =>
              sdk.eventBuilder.buildIdentify({ userId: 'customer' }),
            ),
            sdk.eventBuilder.buildPageView(),
          ]
        const buildPayload = rs.fn(() => ({ properties: { title: 'ordinary fallback' } }))

        await expect(
          sdk.hydrateAndTrackCurrentPage(
            {
              cache: { scope: 'private-request' },
              profileId: 'continuation-id',
              replay: { routeKey: '/products', events },
            },
            { routeKey: '/products', buildPayload },
          ),
        ).resolves.toEqual({ accepted: true })
        expect(upsert).not.toHaveBeenCalled()
        expect(ordinaryPage).toHaveBeenCalledExactlyOnceWith({
          properties: { title: 'ordinary fallback' },
        })
        expect(buildPayload).toHaveBeenCalledExactlyOnceWith({ isInitialEmission: true })
        window.dispatchEvent(new Event('online'))
        const flushing = sdk.flush()
        response.reject(new Error('Deferred test response'))
        await flushing
        expect(upsert).toHaveBeenCalledTimes(1)
        const payload = upsert.mock.calls[0]?.[0]
        expect(payload?.profileId).toBe('continuation-id')
        expect(payload?.events).toMatchObject([
          { type: 'page', properties: { title: 'ordinary fallback' } },
        ])
        expect(events.map(({ messageId }) => messageId)).not.toContain(
          payload?.events[0]?.messageId,
        )
      } finally {
        sdk.destroy()
        rs.restoreAllMocks()
      }
    },
  )
})
