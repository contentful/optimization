import ApiClient, {
  EventBuilder,
  type ApiClientConfig,
  type ChangeArray,
  type EventBuilderConfig,
  type GlobalApiConfigProperties,
  type Profile,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import type { LogLevels } from 'logger'
import { ConsoleLogSink, logger } from 'logger'
import type AnalyticsBase from './analytics/AnalyticsBase'
import { Personalization } from './personalization'
import { batch, changes, consent, personalizations, profile } from './signals'

export interface CoreConfigDefaults {
  changes?: ChangeArray
  consent?: boolean
  profile?: Profile
  personalizations?: SelectedPersonalizationArray
}

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Pick<ApiClientConfig, GlobalApiConfigProperties> {
  /** The API client configuration object */
  api?: Pick<ApiClientConfig, 'personalization' | 'analytics'>

  defaults?: CoreConfigDefaults

  eventBuilder?: EventBuilderConfig

  logLevel?: LogLevels
}

interface ConsentController {
  consent: (accept: boolean) => void
}

abstract class CoreBase implements ConsentController {
  abstract readonly analytics: AnalyticsBase
  readonly api: ApiClient
  readonly eventBuilder: EventBuilder
  readonly config: Omit<CoreConfig, 'name'>
  readonly personalization: Personalization

  constructor(config: CoreConfig) {
    this.config = config

    const { api, defaults, eventBuilder, logLevel, environment, clientId, preview } = config

    logger.addSink(new ConsoleLogSink(logLevel))

    if (defaults) {
      const {
        changes: defaultChanges,
        consent: defaultConsent,
        personalizations: defaultPersonalizations,
        profile: defaultProfile,
      } = defaults

      batch(() => {
        changes.value = defaultChanges
        consent.value = defaultConsent
        personalizations.value = defaultPersonalizations
        profile.value = defaultProfile
      })
    }

    const apiConfig = {
      ...api,
      clientId,
      environment,
      preview,
    }

    this.api = new ApiClient(apiConfig)

    this.eventBuilder = new EventBuilder(
      eventBuilder ?? {
        channel: 'server',
        library: { name: 'Optimization Core', version: '0.0.0' },
      },
    )

    this.personalization = new Personalization(this.api, this.eventBuilder)
  }

  public consent(accept: boolean): void {
    consent.value = accept
  }
}

export default CoreBase
