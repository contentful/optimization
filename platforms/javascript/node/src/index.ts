import { type CoreConfig, CoreStateless } from '@contentful/optimization-core'
import { merge } from 'es-toolkit'

function mergeConfig(config: CoreConfig): CoreConfig {
  return merge(
    {
      event: {
        channel: 'web',
        library: { name: 'Optimization Web API', version: '0.0.0' },
      },
    },
    config,
  )
}

class Optimization extends CoreStateless {
  constructor(config: CoreConfig) {
    const mergedConfig: CoreConfig = mergeConfig(config)

    super(mergedConfig)
  }
}

export default Optimization
