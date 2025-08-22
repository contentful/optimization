import { AnalyticsStateless } from './analytics'
import { AudienceStateless } from './audience'
import { ExperimentsStateless } from './experiments'
import { FlagsStateless } from './flags'
import { PersonalizationStateless } from './personalization'
import CoreBase from './CoreBase'
import ApiClient from './lib/api-client'

const api = new ApiClient({ clientId: 'client-id' })

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless(api)
  audience = new AudienceStateless()
  experiments = new ExperimentsStateless()
  flags = new FlagsStateless()
  personalization = new PersonalizationStateless(api)
}

const config = { name: 'Test', clientId: 'testId' }

describe('CoreBase', () => {
  it('accepts name option', () => {
    const core = new TestCore(config)

    expect(core.name).toEqual(config.name)
  })
})
