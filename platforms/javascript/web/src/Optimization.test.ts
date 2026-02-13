import type { CoreConfig } from '@contentful/optimization-core'
import Optimization from './Optimization'
import { OPTIMIZATION_WEB_SDK_NAME } from './global-constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

describe('Optimization', () => {
  it('sets configured options', () => {
    const web = new Optimization(config)

    expect(web.config.clientId).toEqual(CLIENT_ID)
    expect(web.eventBuilder.library.name).toEqual(OPTIMIZATION_WEB_SDK_NAME)
  })
})
