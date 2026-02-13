import type { CoreConfig } from '@contentful/optimization-core'
import Optimization from './Optimization'
import { OPTIMIZATION_NODE_SDK_NAME } from './global-constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('Optimization', () => {
  it('gives itself a name', () => {
    const node = new Optimization(config)

    expect(node.config.clientId).toEqual(CLIENT_ID)
    expect(node.eventBuilder.library.name).toEqual(OPTIMIZATION_NODE_SDK_NAME)
  })
})
