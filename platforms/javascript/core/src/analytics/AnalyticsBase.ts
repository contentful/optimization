import ProductBase, { type ConsentGuard } from '../ProductBase'
import type ApiClient from '../lib/api-client'
import type { EventBuilder } from '../lib/api-client/builders'
import type { InsightsEvent } from '../lib/api-client/insights/dto'
import { logger } from '../lib/logger'
import { consent, effect, profile } from '../signals'

abstract class AnalyticsBase extends ProductBase<InsightsEvent> implements ConsentGuard {
  constructor(api: ApiClient, builder: EventBuilder) {
    super(api, builder)

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
