import type { ChangeArray } from './lib/api-client/experience/dto/change'
import type { ExperienceArray } from './lib/api-client/experience/dto/experience'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type AnalyticsBase from './analytics/AnalyticsBase'
import ApiClient, { type ApiClientConfig, type ApiConfig } from './lib/api-client'
import { batch, changes, consent, personalizations, profile } from './signals'
import type { EventBuilder } from './lib/builders'
import { Personalization } from './personalization'

export interface CoreConfigDefaults {
  changes?: ChangeArray
  personalizations?: ExperienceArray
  profile?: Profile
}

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Omit<ApiConfig, 'baseUrl' | 'fetchOptions'> {
  /** The name of the SDK built from this Core class (added for demo purposes) */
  name: string

  /** The API client configuration object */
  api?: Omit<ApiClientConfig, 'clientId' | 'environment' | 'preview'>

  defaults?: CoreConfigDefaults
}

interface ConsentController {
  consent: (accept: boolean) => void
}

abstract class CoreBase implements ConsentController {
  abstract readonly analytics: AnalyticsBase
  readonly api: ApiClient
  readonly builder: EventBuilder
  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly personalization: Personalization

  constructor(config: CoreConfig, builder: EventBuilder) {
    const { name, api, clientId, defaults, environment, preview, ...rest } = config

    if (defaults) {
      const {
        changes: defaultChanges,
        personalizations: defaultPersonalizations,
        profile: defaultProfile,
      } = defaults

      batch(() => {
        changes.value = defaultChanges
        personalizations.value = defaultPersonalizations
        profile.value = defaultProfile
      })
    }

    const apiConfig = { ...api, clientId, environment, preview }

    this.api = new ApiClient(apiConfig)
    this.builder = builder
    this.config = { clientId, environment, preview, ...rest }
    this.name = name // only for demo
    this.personalization = new Personalization(this.api, this.builder)
  }

  public consent(accept: boolean): void {
    consent.value = accept
  }
}

export default CoreBase
