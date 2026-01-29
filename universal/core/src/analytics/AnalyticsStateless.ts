import {
  BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type InsightsEvent,
  type PartialProfile,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import AnalyticsBase from './AnalyticsBase'

const LOG_LOCATION = 'Analytics'

/**
 * Arguments for tracking a component/flag view in stateless mode.
 *
 * @public
 * @remarks
 * The `profile` is optional; when omitted, the APIs may infer identity via
 * other means.
 */
export type TrackViewArgs = ComponentViewBuilderArgs & { profile?: PartialProfile }

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
   */
  async trackComponentView(args: TrackViewArgs): Promise<void> {
    logger.info(LOG_LOCATION, 'Processing "component view" event')

    const { profile, ...builderArgs } = args

    const event = this.builder.buildComponentView(builderArgs)

    const intercepted = await this.interceptors.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    await this.sendBatchEvent(parsed, profile)
  }

  /**
   * Build, intercept, validate, and send a flag view event.
   *
   * @param args - {@link TrackViewArgs} used to build the event. Includes an
   * optional partial profile.
   * @returns A promise that resolves once the batch has been sent.
   */
  async trackFlagView(args: TrackViewArgs): Promise<void> {
    logger.debug(LOG_LOCATION, 'Processing "flag view" event')

    const { profile, ...builderArgs } = args

    const event = this.builder.buildFlagView(builderArgs)

    const intercepted = await this.interceptors.event.run(event)

    const parsed = ComponentViewEvent.parse(intercepted)

    await this.sendBatchEvent(parsed, profile)
  }

  /**
   * Send a single {@link InsightsEvent} wrapped in a one‑item batch.
   *
   * @param event - The event to send.
   * @param profile - Optional partial profile to attach to the batch.
   * @returns A promise that resolves when the API call completes.
   * @internal
   */
  private async sendBatchEvent(event: InsightsEvent, profile?: PartialProfile): Promise<void> {
    const batchEvent: BatchInsightsEventArray = BatchInsightsEventArray.parse([
      {
        profile,
        events: [event],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default AnalyticsStateless
