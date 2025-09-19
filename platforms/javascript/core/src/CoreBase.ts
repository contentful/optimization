import type { LogLevels } from 'diary'
import type AnalyticsBase from './analytics/AnalyticsBase'
import ApiClient, {
  type ApiClientConfig,
  type EventBuilderConfig,
  type GlobalApiConfigProperties,
  EventBuilder,
} from './lib/api-client'
import type { ChangeArray } from './lib/api-client/experience/dto/change'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type { SelectedVariantArray } from './lib/api-client/experience/dto/variant'
import { ConsoleLogSink, logger } from './lib/logger'
import { Personalization } from './personalization'
import { batch, changes, consent, profile, variants } from './signals'

export interface CoreConfigDefaults {
  changes?: ChangeArray
  consent?: boolean
  profile?: Profile
  variants?: SelectedVariantArray
}

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Pick<ApiClientConfig, GlobalApiConfigProperties> {
  /** The API client configuration object */
  api?: Pick<ApiClientConfig, 'personalization' | 'analytics'>

  defaults?: CoreConfigDefaults

  eventBuilder?: EventBuilderConfig

  logLevel?: LogLevels

  /** The name of the SDK built from this Core class (added for demo purposes) */
  name?: string
}

interface ConsentController {
  consent: (accept: boolean) => void
}

abstract class CoreBase implements ConsentController {
  abstract readonly analytics: AnalyticsBase
  readonly api: ApiClient
  readonly eventBuilder: EventBuilder
  readonly config: Omit<CoreConfig, 'name'>
  readonly name: string
  readonly personalization: Personalization

  constructor(config: CoreConfig) {
    const { name, api, clientId, defaults, eventBuilder, environment, logLevel, preview, ...rest } =
      config

    logger.addSink(new ConsoleLogSink(logLevel))

    if (defaults) {
      const {
        changes: defaultChanges,
        consent: defaultConsent,
        variants: defaultVariants,
        profile: defaultProfile,
      } = defaults

      batch(() => {
        changes.value = defaultChanges
        consent.value = defaultConsent
        variants.value = defaultVariants
        profile.value = defaultProfile
      })
    }

    const apiConfig = { ...api, clientId, environment, preview }

    this.api = new ApiClient(apiConfig)
    this.eventBuilder = new EventBuilder(
      eventBuilder ?? {
        channel: 'server',
        library: { name: 'Optimization Core', version: '0.0.0' },
      },
    )
    this.config = { clientId, environment, preview, ...rest }
    this.name = name ?? 'Core' // only for demo
    this.personalization = new Personalization(this.api, this.eventBuilder)
  }

  public consent(accept: boolean): void {
    consent.value = accept
  }
}

export default CoreBase
