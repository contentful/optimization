import ApiClient, {
  EventBuilder,
  type ApiClientConfig,
  type EventBuilderConfig,
  type GlobalApiConfigProperties,
} from '@contentful/optimization-api-client'
import type { LogLevels } from 'logger'
import { ConsoleLogSink, logger } from 'logger'
import type AnalyticsBase from './analytics/AnalyticsBase'
import type PersonalizationBase from './personalization/PersonalizationBase'
import type { ProductConfig } from './ProductBase'

/** Options that may be passed to the Core constructor */
export interface CoreConfig extends Pick<ApiClientConfig, GlobalApiConfigProperties> {
  allowedEventTypes?: ProductConfig['allowedEventTypes']

  preventedComponentEvents?: ProductConfig['preventedComponentEvents']

  /** The API client configuration object */
  api?: Pick<ApiClientConfig, 'personalization' | 'analytics'>

  eventBuilder?: EventBuilderConfig

  logLevel?: LogLevels
}

abstract class CoreBase {
  abstract readonly analytics: AnalyticsBase
  abstract readonly personalization: PersonalizationBase
  readonly api: ApiClient
  readonly eventBuilder: EventBuilder
  readonly config: Omit<CoreConfig, 'name'>

  constructor(config: CoreConfig) {
    this.config = config

    const { api, eventBuilder, logLevel, environment, clientId, preview } = config

    logger.addSink(new ConsoleLogSink(logLevel))

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
  }
}

export default CoreBase
