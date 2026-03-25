import {
  BatchInsightsEventArray,
  ExperienceEvent as ExperienceEventSchema,
  InsightsEvent as InsightsEventSchema,
  parseWithFriendlyError,
  type ExperienceEvent as ExperienceEventPayload,
  type InsightsEvent as InsightsEventPayload,
} from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationData, PartialProfile } from './api-schemas'
import CoreBase, { type CoreApiConfig, type CoreConfig } from './CoreBase'
import type { EventBuilderConfig } from './events'

/**
 * Configuration for the Node-specific Optimization SDK.
 *
 * @public
 * @remarks
 * This configuration extends {@link CoreConfig} but allows partial overrides
 * of the event-builder configuration. SDKs commonly inject their own library
 * metadata or channel definitions.
 */
export interface CoreStatelessConfig extends Omit<CoreConfig, 'api'> {
  /**
   * Unified API configuration for stateless environments. Omits stateful-only
   * delivery hooks such as `beaconHandler`.
   */
  api?: Omit<CoreApiConfig, 'beaconHandler'>

  /**
   * Overrides for the event builder configuration. Omits methods that are only
   * useful in stateful environments.
   */
  eventBuilder?: Omit<EventBuilderConfig, 'getLocale' | 'getPageProperties' | 'getUserAgent'>
}

/**
 * Core runtime for stateless environments.
 *
 * @public
 * @see {@link CoreBase}
 */
class CoreStateless extends CoreBase {
  constructor(config: CoreStatelessConfig) {
    super({
      ...config,
      api: config.api ? { ...config.api, beaconHandler: undefined } : undefined,
    })
  }

  protected override async sendExperienceEvent(
    _method: string,
    _args: readonly unknown[],
    event: ExperienceEventPayload,
    profile?: PartialProfile,
  ): Promise<OptimizationData> {
    const intercepted = await this.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(ExperienceEventSchema, intercepted)

    return await this.api.experience.upsertProfile({
      profileId: profile?.id,
      events: [validEvent],
    })
  }

  protected override async sendInsightsEvent(
    _method: string,
    _args: readonly unknown[],
    event: InsightsEventPayload,
    profile?: PartialProfile,
  ): Promise<void> {
    const intercepted = await this.interceptors.event.run(event)
    const validEvent = parseWithFriendlyError(InsightsEventSchema, intercepted)

    const batchEvent: BatchInsightsEventArray = parseWithFriendlyError(BatchInsightsEventArray, [
      {
        profile,
        events: [validEvent],
      },
    ])

    await this.api.insights.sendBatchEvents(batchEvent)
  }
}

export default CoreStateless
