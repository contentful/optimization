import type { OptimizationData } from './api-schemas'
import CoreStateless from './CoreStateless'

const EMPTY_OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedPersonalizations: [],
  profile: {
    id: 'profile-id',
    stableId: 'profile-id',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session-id',
      isReturningVisitor: false,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: '',
        url: 'https://example.test/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
}

describe('CoreStateless', () => {
  it('strips beaconHandler from stateless api config', () => {
    const beaconHandler = rs.fn(() => true)
    const core: unknown = Reflect.construct(CoreStateless, [
      {
        clientId: 'key_123',
        environment: 'main',
        api: {
          beaconHandler,
          insightsBaseUrl: 'https://ingest.example.test/',
        },
      },
    ])

    if (!(core instanceof CoreStateless)) {
      throw new Error('Failed to construct CoreStateless')
    }

    expect(Reflect.get(core.api.insights, 'beaconHandler')).toBeUndefined()
  })

  it('sends explicit profiles through Experience upserts', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await core.identify({
      userId: 'user-123',
      profile: { id: 'profile-123' },
    })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [expect.objectContaining({ type: 'identify' })],
      }),
    )
  })

  it('sends sticky component views through both Experience and Insights', async () => {
    const core = new CoreStateless({ clientId: 'key_123', environment: 'main' })
    const upsertProfile = rs
      .spyOn(core.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await core.trackView({
      componentId: 'hero-banner',
      sticky: true,
      viewId: 'hero-banner-view',
      viewDurationMs: 1000,
      profile: { id: 'profile-123' },
    })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-123',
        events: [expect.objectContaining({ type: 'component' })],
      }),
    )
    expect(sendBatchEvents).toHaveBeenCalledWith([
      {
        profile: { id: 'profile-123' },
        events: [expect.objectContaining({ type: 'component' })],
      },
    ])
  })
})
