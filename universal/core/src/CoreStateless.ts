import type { EventBuilderConfig } from '@contentful/optimization-api-client'
import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PersonalizationStateless } from './personalization'

/**
 * Configuration for the Node-specific Optimization SDK.
 *
 * @public
 * @remarks
 * This configuration extends {@link CoreConfig} but allows partial overrides
 * of the event-builder configuration. SDKs commonly inject their own library
 * metadata or channel definitions.
 */
export interface CoreStatelessConfig extends CoreConfig {
  /**
   * Override configuration for the analytics (Insights) API client. Omits
   * `beaconHandler`.
   */
  analytics?: Omit<CoreConfig['analytics'], 'beaconHandler'>

  /**
   * Overrides for the event builder configuration. Omits methods that are only
   * useful in stateful environments.
   */
  eventBuilder?: Omit<EventBuilderConfig, 'getLocale' | 'getPageProperties' | 'getUserAgent'>
}

/**
 * Core runtime that constructs product instances for stateless environments.
 *
 * @public
 * @see {@link CoreBase}
 */
class CoreStateless extends CoreBase {
  /** Stateless analytics product. */
  readonly analytics: AnalyticsStateless
  /** Stateless personalization product. */
  readonly personalization: PersonalizationStateless

  /**
   * Create a stateless core. Product instances share the same API client and
   * event builder configured in {@link CoreBase}.
   *
   * @param config - Stateless Core configuration.
   * @example
   * ```ts
   * const sdk = new CoreStateless({ clientId: 'app', environment: 'prod' })
   * core.analytics.trackFlagView({ componentId: 'hero' })
   * // or
   * core.trackFlagView({ componentId: 'hero' })
   * ```
   */
  constructor(config: CoreStatelessConfig) {
    super(config)

    this.analytics = new AnalyticsStateless({
      api: this.api,
      builder: this.eventBuilder,
      interceptors: this.interceptors,
    })

    this.personalization = new PersonalizationStateless({
      api: this.api,
      builder: this.eventBuilder,
      interceptors: this.interceptors,
    })
  }
}

export default CoreStateless
