import ApiClient, {
  EventBuilder,
  type InsightsEvent as AnalyticsEvent,
  type ApiClientConfig,
  type EventBuilderConfig,
  type GlobalApiConfigProperties,
  type ExperienceEvent as PersonalizationEvent,
} from '@contentful/optimization-api-client'
import type { LogLevels } from 'logger'
import { ConsoleLogSink, logger } from 'logger'
import type AnalyticsBase from './analytics/AnalyticsBase'
import type { AnalyticsConfigDefaults, AnalyticsStates } from './analytics/AnalyticsBase'
import {
  Personalization,
  type PersonalizationConfigDefaults,
  type PersonalizationStates,
} from './personalization'
import { consent, event, toObservable, type Observable } from './signals'

export interface CoreConfigDefaults {
  consent?: boolean
  personalization?: PersonalizationConfigDefaults
  analytics?: AnalyticsConfigDefaults
}

export interface CoreStates extends AnalyticsStates, PersonalizationStates {
  consent: Observable<boolean | undefined>
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
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

    if (defaults?.consent !== undefined) {
      const { consent: defaultConsent } = defaults
      consent.value = defaultConsent
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

    this.personalization = new Personalization(
      this.api,
      this.eventBuilder,
      defaults?.personalization,
    )
  }

  get states(): CoreStates {
    return {
      ...this.analytics.states,
      ...this.personalization.states,
      consent: toObservable(consent),
      eventStream: toObservable(event),
    }
  }

  consent(accept: boolean): void {
    consent.value = accept
  }

  /** Do not reset consent, resetting personalization _currently_ also resets analytics' dependencies */
  reset(): void {
    this.personalization.reset()
  }
}

export default CoreBase
