import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless(this.api, this.eventBuilder)
}

const config: CoreConfig = {
  name: 'Test',
  clientId: 'testId',
}

describe('CoreBase', () => {
  it('accepts name option', () => {
    const core = new TestCore(config)

    expect(core.name).toEqual(config.name)
  })
})
