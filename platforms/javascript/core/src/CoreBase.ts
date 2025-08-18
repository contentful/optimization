import Analytics from './analytics'
import Audience from './audience'
import Experiments from './experiments'
import ApiClient from './lib/api-client'
import type { ApiClientConfig, ApiConfig } from './lib/api-client'
import Personalization from './personalization'

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Omit<ApiConfig, 'baseUrl' | 'fetchOptions'> {
  /** The name of the SDK built from this Core class (added for demo purposes) */
  name: string

  /** The API client configuration object */
  api?: Omit<ApiClientConfig, 'clientId' | 'environment' | 'preview'>
}

abstract class CoreBase {
  readonly analytics: Analytics
  readonly audience: Audience
  readonly experiments: Experiments
  readonly personalization: Personalization

  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly api: ApiClient

  constructor(config: CoreConfig) {
    const { name, api, clientId, environment, preview, ...rest } = config

    const apiConfig = { ...api, clientId, environment, preview }

    this.name = name // only for demo
    this.config = { clientId, environment, preview, ...rest }

    this.api = new ApiClient(apiConfig)

    this.analytics = new Analytics(this.api)
    this.audience = new Audience()
    this.experiments = new Experiments()
    this.personalization = new Personalization(this.api)
  }
}

export default CoreBase
