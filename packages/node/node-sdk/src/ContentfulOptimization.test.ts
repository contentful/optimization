import type { CoreConfig } from '@contentful/optimization-core'
import ContentfulOptimization from './ContentfulOptimization'
import { OPTIMIZATION_NODE_SDK_NAME } from './constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('ContentfulOptimization', () => {
  it('gives itself a name', () => {
    const node = new ContentfulOptimization(config)

    expect(node.config.clientId).toEqual(CLIENT_ID)
    expect(node.eventBuilder.library.name).toEqual(OPTIMIZATION_NODE_SDK_NAME)
  })

  it('forwards request options through direct stateless event methods', async () => {
    const node = new ContentfulOptimization(config)
    const upsertProfile = rs.spyOn(node.api.experience, 'upsertProfile').mockResolvedValue({
      changes: [],
      selectedOptimizations: [],
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
    })

    await node.page({ profile: { id: 'profile-id' } }, { locale: 'de-DE', preflight: true })

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-id',
        events: [expect.objectContaining({ type: 'page' })],
      }),
      expect.objectContaining({ locale: 'de-DE', preflight: true }),
    )
  })
})
