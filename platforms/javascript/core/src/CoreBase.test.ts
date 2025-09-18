import { Analytics } from './analytics'
import { EventHandlerStateless } from './analytics/EventHandler'
import CoreBase, { type CoreConfig } from './CoreBase'
import ApiClient from './lib/api-client'
import { EventBuilder } from './lib/api-client/builders'

const api = new ApiClient({ clientId: 'client-id' })
const builder = new EventBuilder({ channel: 'server', library: { name: 'TestAPI', version: '0' } })

class TestCore extends CoreBase {
  analytics = new Analytics(api, builder, new EventHandlerStateless(api))
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
