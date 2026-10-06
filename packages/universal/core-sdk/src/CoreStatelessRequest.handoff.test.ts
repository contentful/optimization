import type { OptimizationData } from './api-schemas'
import CoreStateless from './CoreStateless'
import type { InitialExperienceEvent } from './CoreStatelessRequest'
import { profile } from './test/fixtures/profile'
import { selectedOptimizations } from './test/fixtures/selectedOptimizations'

const DATA: OptimizationData = { profile, selectedOptimizations, changes: [] }

describe('request handoff preparation', () => {
  it('previews the ordered transformed events under the continuation, retaining linked response data', async () => {
    const core = new CoreStateless({ spaceId: 'key_123', locale: 'en-US' })
    const returned = { ...DATA, profile: { ...profile, id: 'linked-profile' } }
    const preview = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(returned)
    const intercepted: string[] = []
    core.interceptors.event.add((event) => {
      intercepted.push(event.type)
      return event.type === 'track'
        ? { ...event, properties: { ...event.properties, prepared: true } }
        : event
    })
    const request = core.forRequest({
      consent: { events: true, persistence: true },
      profile: { id: 'continuation' },
      locale: 'de-DE',
      eventContext: { userAgent: 'server-agent' },
      experienceOptions: { plainText: false, ip: '203.0.113.10' },
    })

    const { handoff, data } = await request.prepareRequestHandoff({
      routeKey: '/products?campaign=one',
      initialEvents: [
        { type: 'identify', userId: 'customer' },
        { type: 'track', event: 'campaign' },
      ],
      page: { properties: { url: 'https://analytics.test/override' } },
    })

    expect(handoff.profileId).toBe('continuation')
    expect(handoff.replay?.routeKey).toBe('/products?campaign=one')
    expect(handoff.replay?.locale).toBe('de-DE')
    expect(handoff.replay?.events.map(({ type }) => type)).toEqual(['identify', 'track', 'page'])
    expect(intercepted).toEqual(['identify', 'track', 'page'])
    expect(preview).toHaveBeenCalledWith(
      { profileId: 'continuation', events: handoff.replay?.events },
      { preflight: true, plainText: false, ip: '203.0.113.10', locale: 'de-DE' },
    )
    expect(handoff.replay?.events[1]).toMatchObject({ properties: { prepared: true } })
    expect(handoff.replay?.events[0]).toMatchObject({
      context: { userAgent: 'server-agent', locale: 'de-DE', gdpr: { isConsentGiven: true } },
    })
    expect(data).toBe(returned)
    expect(request.profile).toBe(returned.profile)
    expect(request.canPersistProfile).toBe(true)
    expect(handoff.state).toBeUndefined()
  })

  it('uses the profile ID returned by preview when the request has no known ID', async () => {
    const core = new CoreStateless({ spaceId: 'key_123' })
    const preview = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(DATA)
    const request = core.forRequest({ consent: true })
    expect(request.profile).toBeUndefined()
    const result = await request.prepareRequestHandoff({ routeKey: '/landing' })
    expect(preview).toHaveBeenCalledWith(
      { profileId: undefined, events: result.handoff.replay?.events },
      expect.objectContaining({ preflight: true }),
    )
    expect(result.handoff.profileId).toBe(DATA.profile.id)
    expect(request.profile).toBe(DATA.profile)
  })

  it.each([undefined, profile.id])(
    'retains valid events and only a known ID after preview failure (%s)',
    async (profileId) => {
      const core = new CoreStateless({ spaceId: 'key_123' })
      const preview = rs
        .spyOn(core.api.experience, 'upsertProfile')
        .mockRejectedValue(new Error('preview unavailable'))
      const request = core.forRequest({
        consent: { events: true, persistence: true },
        profile: profileId === undefined ? undefined : { id: profileId },
      })
      const result = await request.prepareRequestHandoff({ routeKey: '/landing' })
      expect(result.data).toBeUndefined()
      expect(result.handoff.profileId).toBe(profileId)
      expect(request.profile?.id).toBe(profileId)
      expect(result.handoff.replay?.events).toHaveLength(1)
      expect(preview).toHaveBeenCalledWith(
        { profileId, events: result.handoff.replay?.events },
        expect.objectContaining({ preflight: true }),
      )
    },
  )

  it('uses the API response profile for later request operations without rewriting linked response data', async () => {
    const core = new CoreStateless({ spaceId: 'key_123' })
    const preview = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(DATA)
    const request = core.forRequest({ consent: true, profile: { id: 'continuation' } })
    const first = await request.prepareRequestHandoff({ routeKey: '/one' })
    const second = await request.prepareRequestHandoff({ routeKey: '/two' })
    expect(first.handoff.profileId).toBe('continuation')
    expect(second.handoff.profileId).toBe(DATA.profile.id)
    expect(preview.mock.calls.map(([payload]) => payload.profileId)).toEqual([
      'continuation',
      DATA.profile.id,
    ])
    expect(first.handoff.replay?.events[0]?.messageId).not.toBe(
      second.handoff.replay?.events[0]?.messageId,
    )
  })

  it('keeps persistence permission independent of a consent-blocked page without inventing an ID', async () => {
    const core = new CoreStateless({ spaceId: 'key_123' })
    const preview = rs.spyOn(core.api.experience, 'upsertProfile')
    const request = core.forRequest({ consent: { events: false, persistence: true } })
    const { handoff } = await request.prepareRequestHandoff({ routeKey: '/' })
    expect(handoff.profileId).toBeUndefined()
    expect(handoff.replay).toBeUndefined()
    expect(request.canPersistProfile).toBe(true)
    expect(preview).not.toHaveBeenCalled()
  })

  it('prepares only consent-permitted inputs and stamps the actual consent', async () => {
    const core = new CoreStateless({ spaceId: 'key_123', allowedEventTypes: ['page', 'track'] })
    const preview = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(DATA)
    const request = core.forRequest({ consent: false })
    const { handoff } = await request.prepareRequestHandoff({
      routeKey: '/',
      initialEvents: [
        { type: 'identify', userId: 'customer' },
        { type: 'track', event: 'allowed' },
      ],
    })
    expect(handoff.replay?.events.map(({ type }) => type)).toEqual(['track', 'page'])
    expect(handoff.replay?.events.every((event) => !event.context.gdpr.isConsentGiven)).toBe(true)
    expect(preview).toHaveBeenCalledTimes(1)
  })

  it.each([
    { type: 'track', count: 200 },
    { type: 'identify', count: 51 },
  ] as const)(
    'rejects an oversized $type prefix without producing a replay',
    async ({ type, count }) => {
      const core = new CoreStateless({ spaceId: 'key_123' })
      const preview = rs.spyOn(core.api.experience, 'upsertProfile')
      const initialEvents: InitialExperienceEvent[] = Array.from({ length: count }, () =>
        type === 'identify' ? { type, userId: 'customer' } : { type, event: 'track' },
      )
      const { handoff } = await core
        .forRequest({ consent: true })
        .prepareRequestHandoff({ routeKey: '/', initialEvents })
      expect(handoff.replay).toBeUndefined()
      expect(preview).not.toHaveBeenCalled()
    },
  )

  it('rejects invalid route/event inputs before preview', async () => {
    const core = new CoreStateless({ spaceId: 'key_123' })
    const preview = rs.spyOn(core.api.experience, 'upsertProfile')
    const request = core.forRequest({ consent: true, profile: { id: 'continuation' } })
    const invalid: unknown = await Reflect.apply(request.prepareRequestHandoff, request, [
      { routeKey: '/', initialEvents: [{ type: 'page' }] },
    ])
    expect(invalid).toEqual({
      handoff: { cache: { scope: 'private-request' }, profileId: 'continuation' },
    })
    expect(
      (await request.prepareRequestHandoff({ routeKey: 'https://example.test/' })).handoff.replay,
    ).toBeUndefined()
    expect(preview).not.toHaveBeenCalled()
  })
})
