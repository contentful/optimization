import type ApiClient from '@contentful/optimization-api-client'
import type {
  InsightsEvent as AnalyticsEvent,
  EventBuilder,
  Profile,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import ProductBase, { type ConsentGuard, type ProductConfig } from '../ProductBase'
import { consent, effect, type Observable, profile, toObservable } from '../signals'

export interface AnalyticsProductConfigDefaults {
  profile?: Profile
}

export interface AnalyticsProductConfig extends ProductConfig {
  defaults?: AnalyticsProductConfigDefaults
}

export interface AnalyticsStates {
  profile: Observable<Profile | undefined>
}

abstract class AnalyticsBase extends ProductBase<AnalyticsEvent> implements ConsentGuard {
  readonly states: AnalyticsStates = {
    profile: toObservable(profile),
  }

  constructor(api: ApiClient, builder: EventBuilder, config?: AnalyticsProductConfig) {
    super(api, builder, config)

    const { defaults } = config ?? {}

    if (defaults?.profile !== undefined) {
      const { profile: defaultProfile } = defaults
      profile.value = defaultProfile
    }

    effect(() => {
      const id = profile.value?.id

      logger.info(
        `[Analytics] Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.info(`[Analytics] Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })
  }

  hasConsent(name: string): boolean {
    if (['trackComponentView', 'trackFlagView'].includes(name)) name = 'component'

    return super.hasConsent(name)
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  abstract trackComponentView(...args: unknown[]): Promise<void> | void
  abstract trackFlagView(...args: unknown[]): Promise<void> | void
}

export default AnalyticsBase
