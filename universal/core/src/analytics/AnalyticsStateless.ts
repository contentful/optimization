import {
  InsightsEvent as AnalyticsEvent,
  BatchInsightsEventArray,
  parseWithFriendlyError,
  type ComponentClickBuilderArgs,
  type ComponentHoverBuilderArgs,
  type ComponentViewBuilderArgs,
  type PartialProfile,
} from '@contentful/optimization-api-client'
import { createScopedLogger } from 'logger'
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
export type TrackComponentViewArgs = ComponentViewBuilderArgs & { profile?: PartialProfile }
export type TrackComponentClickArgs = ComponentClickBuilderArgs & { profile?: PartialProfile }
export type TrackComponentHoverArgs = ComponentHoverBuilderArgs & { profile?: PartialProfile }

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
   * @param args - {@link TrackComponentViewArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackComponentView({ componentId: 'hero-banner', profile: { id: 'user-1' } })
   * ```
   */
  async trackComponentView(args: TrackComponentViewArgs): Promise<void> {
    logger.info('Processing "component view" event')

    const { profile, ...builderArgs } = args

    const event = this.builder.buildComponentView(builderArgs)

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

    const event = this.builder.buildComponentClick(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Build, intercept, validate, and send a component hover event.
   *
   * @param args - {@link TrackComponentHoverArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackComponentHover({ componentId: 'hero-banner', profile: { id: 'user-1' } })
   * ```
   */
  async trackComponentHover(args: TrackComponentHoverArgs): Promise<void> {
    logger.info('Processing "component hover" event')

    const { profile, ...builderArgs } = args

    const event = this.builder.buildComponentHover(builderArgs)

    await this.sendBatchEvent(event, profile)
  }

  /**
   * Build, intercept, validate, and send a flag view event.
   *
   * @param args - {@link TrackComponentViewArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   * @example
   * ```ts
   * await analytics.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  async trackFlagView(args: TrackComponentViewArgs): Promise<void> {
    logger.debug('Processing "flag view" event')

    const { profile, ...builderArgs } = args

    const event = this.builder.buildFlagView(builderArgs)

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
