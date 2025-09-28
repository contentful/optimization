import type { LogLevels } from 'diary'
import type AnalyticsBase from './analytics/AnalyticsBase'
import { Content, type ContentfulClientConfig } from './content'
import ApiClient, {
  EventBuilder,
  type ApiClientConfig,
  type EventBuilderConfig,
  type GlobalApiConfigProperties,
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
export interface CoreConfig
  extends Pick<ApiClientConfig, GlobalApiConfigProperties>,
    ContentfulClientConfig {
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
  readonly content: Content
  readonly personalization: Personalization

  constructor(config: CoreConfig) {
    this.config = config

    const {
      api,
      contentToken,
      contentEnv,
      defaults,
      eventBuilder,
      logLevel,
      optimizationEnv,
      optimizationKey,
      preview,
      contentSpaceId,
    } = config

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

    const contentConfig = {
      contentToken,
      contentEnv,
      contentSpaceId,
    }

    this.content = new Content(contentConfig)

    const apiConfig = {
      ...api,
      optimizationKey,
      optimizationEnv,
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
