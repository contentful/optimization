import analytics from './analytics'
import audience from './audience'
import experiments from './experiments'
import ApiClient from './lib/api-client'
import type { ApiClientConfig } from './lib/api-client'
import personalization from './personalization'

/** Options that may be passed to the Core constructor */
export interface CoreConfig {
  /** The name of the SDK built from this Core class (added for demo purposes) */
  name: string

  /** The API client configuration object */
  api?: ApiClientConfig
}

export default abstract class CoreBase {
  readonly analytics = analytics
  readonly audience = audience
  readonly experiments = experiments
  readonly personalization = personalization

  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly api: ApiClient

  constructor(config: CoreConfig) {
    const { name, ...rest } = config

    this.name = name // only for demo
    this.config = rest

    this.api = new ApiClient(rest.api)
  }
}
