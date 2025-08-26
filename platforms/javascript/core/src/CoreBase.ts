import { batch, signal, type Signal } from '@preact/signals-core'
import type { ChangeArrayType } from './lib/api-client/experience/dto/change'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ProfileType } from './lib/api-client/experience/dto/profile'
import type AnalyticsBase from './analytics/AnalyticsBase'
import type FlagsBase from './flags/FlagsBase'
import type PersonalizationBase from './personalization/PersonalizationBase'
import ApiClient, { type ApiClientConfig, type ApiConfig } from './lib/api-client'

export interface CoreConfigDefaults {
  audiences?: string[]
  experiments?: ExperienceArrayType
  flags?: ChangeArrayType
  personalizations?: ExperienceArrayType
  profile?: ProfileType
}

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Omit<ApiConfig, 'baseUrl' | 'fetchOptions'> {
  /** The name of the SDK built from this Core class (added for demo purposes) */
  name: string

  /** The API client configuration object */
  api?: Omit<ApiClientConfig, 'clientId' | 'environment' | 'preview'>

  defaults?: CoreConfigDefaults
}

export interface Signals {
  audiences: Signal<string[] | undefined>
  experiences: Signal<ExperienceArrayType | undefined>
  experiments: Signal<ExperienceArrayType | undefined>
  flags: Signal<ChangeArrayType | undefined>
  personalizations: Signal<ExperienceArrayType | undefined>
  profile: Signal<ProfileType | undefined>
}

export const signals: Signals = {
  audiences: signal<string[] | undefined>(),
  experiences: signal<ExperienceArrayType | undefined>(),
  experiments: signal<ExperienceArrayType | undefined>(),
  flags: signal<ChangeArrayType | undefined>(),
  personalizations: signal<ExperienceArrayType | undefined>(),
  profile: signal<ProfileType | undefined>(),
}

abstract class CoreBase {
  abstract readonly analytics: AnalyticsBase
  abstract readonly flags: FlagsBase
  abstract readonly personalization: PersonalizationBase

  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly api: ApiClient

  constructor(config: CoreConfig) {
    const { name, api, clientId, defaults, environment, preview, ...rest } = config

    if (defaults) {
      const { audiences, experiments, flags, personalizations, profile } = defaults

      batch(() => {
        signals.audiences.value = audiences
        signals.experiments.value = experiments
        signals.flags.value = flags
        signals.personalizations.value = personalizations
        signals.profile.value = profile
      })
    }

    const apiConfig = { ...api, clientId, environment, preview }

    this.name = name // only for demo
    this.config = { clientId, environment, preview, ...rest }

    this.api = new ApiClient(apiConfig)
  }
}

export default CoreBase
