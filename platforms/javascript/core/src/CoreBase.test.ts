import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import ApiClient from './lib/api-client'
import { EventBuilder } from './lib/builders'

const api = new ApiClient({ clientId: 'client-id' })
const builder = new EventBuilder({ channel: 'server', library: { name: 'TestAPI', version: '0' } })

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless(api, builder)
}

const config: CoreConfig = {
  name: 'Test',
  clientId: 'testId',
}

describe('CoreBase', () => {
  it('accepts name option', () => {
    const core = new TestCore(config, builder)

    expect(core.name).toEqual(config.name)
  })
})
