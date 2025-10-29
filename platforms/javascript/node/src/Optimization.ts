import { type App, type CoreConfig, CoreStateless } from '@contentful/optimization-core'
import { merge } from 'es-toolkit'

export interface OptimizationNodeConfig extends CoreConfig {
  app?: App
}

function mergeConfig(config: OptimizationNodeConfig): CoreConfig {
  return merge(
    {
      eventBuilder: {
        channel: 'server',
        library: { name: 'Optimization Node API', version: '0.0.0' },
      },
    },
    config,
  )
}

class Optimization extends CoreStateless {
  constructor(config: OptimizationNodeConfig) {
    const mergedConfig: CoreConfig = mergeConfig(config)

    super(mergedConfig)
  }
}

export default Optimization
