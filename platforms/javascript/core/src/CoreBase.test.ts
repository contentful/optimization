import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless(this.api, this.eventBuilder)
}

const OPTIMIZATION_KEY = 'key_123'
const OPTIMIZATION_ENV = 'main'
const CONTENT_TOKEN = 'token_123'
const CONTENT_ENV = 'master'
const CONTENT_SPACE_ID = 'space_123'

const config: CoreConfig = {
  optimizationKey: OPTIMIZATION_KEY,
  optimizationEnv: OPTIMIZATION_ENV,
  contentEnv: CONTENT_ENV,
  contentSpaceId: CONTENT_SPACE_ID,
  contentToken: CONTENT_TOKEN,
}

describe('CoreBase', () => {
  it('allows access to the original configuration options', () => {
    const core = new TestCore(config)

    expect(core.config).toEqual(config)
  })
})
