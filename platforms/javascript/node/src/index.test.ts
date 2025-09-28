import type { CoreConfig } from '@contentful/optimization-core'
import Optimization from './'

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

describe('Optimization', () => {
  it('gives itself a name', () => {
    const node = new Optimization(config)

    expect(node.config.optimizationKey).toEqual(OPTIMIZATION_KEY)
  })
})
