import {
  InsightsEvent as AnalyticsEvent,
  BatchInsightsEventArray,
  parseWithFriendlyError,
  type PartialProfile,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { ComponentClickBuilderArgs, HoverBuilderArgs, ViewBuilderArgs } from '../events'
import AnalyticsBase from './AnalyticsBase'

const logger = createScopedLogger('Analytics')

/**
 * Arguments for tracking a component/flag view in stateless mode.
 *
 * @public
 * @remarks
 * The `profile` is optional; when omitted, the APIs may infer identity via
 * other means.
 */
export type TrackViewArgs = ViewBuilderArgs & { profile?: PartialProfile }
export type TrackComponentClickArgs = ComponentClickBuilderArgs & { profile?: PartialProfile }
export type TrackHoverArgs = HoverBuilderArgs & { profile?: PartialProfile }

/**
 * Stateless analytics implementation that sends each event immediately in a
 * single‑event batch.
 *
 * @public
 */
class AnalyticsStateless extends AnalyticsBase {
  /**
   * Build, intercept, validate, and send a component view event.
   *
   * @param args - {@link TrackViewArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackView({ componentId: 'hero-banner', profile: { id: 'user-1' } })
   * ```
   */
  async trackView(args: TrackViewArgs): Promise<void> {
    logger.info('Processing "component view" event')

    const { profile, ...builderArgs } = args

    const event = this.eventBuilder.buildView(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Build, intercept, validate, and send a component click event.
   *
   * @param args - {@link TrackComponentClickArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackComponentClick({ componentId: 'hero-banner', profile: { id: 'user-1' } })
   * ```
   */
  async trackComponentClick(args: TrackComponentClickArgs): Promise<void> {
    logger.info('Processing "component click" event')

    const { profile, ...builderArgs } = args

    const event = this.eventBuilder.buildComponentClick(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Build, intercept, validate, and send a component hover event.
   *
   * @param args - {@link TrackHoverArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackHover({ componentId: 'hero-banner', profile: { id: 'user-1' } })
   * ```
   */
  async trackHover(args: TrackHoverArgs): Promise<void> {
    logger.info('Processing "component hover" event')

    const { profile, ...builderArgs } = args

    const event = this.eventBuilder.buildHover(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Build, intercept, validate, and send a flag view event.
   *
   * @param args - {@link TrackViewArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  async trackFlagView(args: TrackViewArgs): Promise<void> {
    logger.debug('Processing "flag view" event')

    const { profile, ...builderArgs } = args

    const event = this.eventBuilder.buildFlagView(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Send a single {@link AnalyticsEvent} wrapped in a one‑item batch.
   *
   * @param event - The event to send.
   * @param profile - Optional partial profile to attach to the batch.
   * @returns A promise that resolves when the API call completes.
   * @internal
   */
  private async sendBatchEvent(event: AnalyticsEvent, profile?: PartialProfile): Promise<void> {
    const intercepted = await this.interceptors.event.run(event)

    const parsed = parseWithFriendlyError(AnalyticsEvent, intercepted)

    const batchEvent: BatchInsightsEventArray = parseWithFriendlyError(BatchInsightsEventArray, [
      {
        profile,
        events: [parsed],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default AnalyticsStateless
