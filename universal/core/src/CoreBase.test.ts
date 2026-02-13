import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import { OPTIMIZATION_CORE_SDK_NAME } from './global-constants'
import { PersonalizationStateless } from './personalization'

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless({
    api: this.api,
    builder: this.eventBuilder,
    interceptors: this.interceptors,
  })
  personalization = new PersonalizationStateless({
    api: this.api,
    builder: this.eventBuilder,
    interceptors: this.interceptors,
  })
}

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('CoreBase', () => {
  it('allows access to the original configuration options', () => {
    const core = new TestCore(config)

    expect(core.config).toEqual(config)
    expect(core.eventBuilder.library.name).toEqual(OPTIMIZATION_CORE_SDK_NAME)
  })
})
