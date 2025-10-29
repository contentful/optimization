import type {
  InsightsEvent as AnalyticsEvent,
  ExperienceEvent as PersonalizationEvent,
} from '@contentful/optimization-api-client'
import {
  AnalyticsStateful,
  type AnalyticsProductConfigDefaults,
  type AnalyticsStates,
} from './analytics'
import type { ConsentController } from './Consent'
import CoreBase, { type CoreConfig } from './CoreBase'
import {
  PersonalizationStateful,
  type PersonalizationProductConfigDefaults,
  type PersonalizationStates,
} from './personalization'
import { consent, event, toObservable, type Observable } from './signals'

export interface CoreStates extends AnalyticsStates, PersonalizationStates {
  consent: Observable<boolean | undefined>
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
}

export interface CoreConfigDefaults {
  consent?: boolean
  personalization?: PersonalizationProductConfigDefaults
  analytics?: AnalyticsProductConfigDefaults
}

export interface CoreStatefulConfig extends CoreConfig {
  defaults?: CoreConfigDefaults
}

class CoreStateful extends CoreBase implements ConsentController {
  readonly analytics: AnalyticsStateful
  readonly personalization: PersonalizationStateful

  constructor(config: CoreStatefulConfig) {
    super(config)

    const { allowedEventTypes, defaults, preventedComponentEvents } = config

    if (defaults?.consent !== undefined) {
      const { consent: defaultConsent } = defaults
      consent.value = defaultConsent
    }

    this.analytics = new AnalyticsStateful(this.api, this.eventBuilder, {
      allowedEventTypes,
      preventedComponentEvents,
      defaults: defaults?.analytics,
    })

    this.personalization = new PersonalizationStateful(this.api, this.eventBuilder, {
      allowedEventTypes,
      preventedComponentEvents,
      defaults: defaults?.personalization,
    })
  }

  get states(): CoreStates {
    return {
      ...this.analytics.states,
      ...this.personalization.states,
      consent: toObservable(consent),
      eventStream: toObservable(event),
    }
  }

  /** Do not reset consent, resetting personalization _currently_ also resets analytics' dependencies */
  reset(): void {
    this.personalization.reset()
  }

  consent(accept: boolean): void {
    consent.value = accept
  }
}

export default CoreStateful
