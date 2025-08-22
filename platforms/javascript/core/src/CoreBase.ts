import type AnalyticsBase from './analytics/AnalyticsBase'
import type AudienceBase from './audience/AudienceBase'
import type ExperimentsBase from './experiments/ExperimentsBase'
import type FlagsBase from './flags/FlagsBase'
import type PersonalizationBase from './personalization/PersonalizationBase'
import ApiClient, { type ApiClientConfig, type ApiConfig } from './lib/api-client'

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Omit<ApiConfig, 'baseUrl' | 'fetchOptions'> {
  /** The name of the SDK built from this Core class (added for demo purposes) */
  name: string

  /** The API client configuration object */
  api?: Omit<ApiClientConfig, 'clientId' | 'environment' | 'preview'>
}

abstract class CoreBase {
  abstract readonly analytics: AnalyticsBase
  abstract readonly audience: AudienceBase
  abstract readonly experiments: ExperimentsBase
  abstract readonly flags: FlagsBase
  abstract readonly personalization: PersonalizationBase

  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly api: ApiClient

  // TODO: consent guard
  constructor(config: CoreConfig) {
    const { name, api, clientId, environment, preview, ...rest } = config

    const apiConfig = { ...api, clientId, environment, preview }

    this.name = name // only for demo
    this.config = { clientId, environment, preview, ...rest }

    this.api = new ApiClient(apiConfig)
  }
}

export default CoreBase
