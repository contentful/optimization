import type ApiClient from '@contentful/optimization-api-client'
import type { EventBuilder, InsightsEvent, Profile } from '@contentful/optimization-api-client'
import { logger } from 'logger'
import ProductBase, { type ConsentGuard } from '../ProductBase'
import { consent, effect, type Observable, profile, toObservable } from '../signals'

export interface AnalyticsConfigDefaults {
  profile?: Profile
}

export interface AnalyticsStates {
  profile: Observable<Profile | undefined>
}

abstract class AnalyticsBase extends ProductBase<InsightsEvent> implements ConsentGuard {
  readonly states: AnalyticsStates = {
    profile: toObservable(profile),
  }

  constructor(api: ApiClient, builder: EventBuilder, defaults?: AnalyticsConfigDefaults) {
    super(api, builder)

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

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  abstract trackComponentView(...args: unknown[]): Promise<void> | void
  abstract trackFlagView(...args: unknown[]): Promise<void> | void
}

export default AnalyticsBase
