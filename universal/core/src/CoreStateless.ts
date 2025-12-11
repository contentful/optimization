import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PersonalizationStateless } from './personalization'

/**
 * Core runtime that constructs product instances for stateless environments.
 *
 * @public
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
   * @param config - Core configuration.
   * @example
   * ```ts
   * const sdk = new CoreStateless({ clientId: 'app', environment: 'prod' })
   * core.analytics.trackFlagView({ componentId: 'hero' })
   * // or
   * core.trackFlagView({ componentId: 'hero' })
   * ```
   */
  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateless(this.api, this.eventBuilder)
    this.personalization = new PersonalizationStateless(this.api, this.eventBuilder)
  }
}

export default CoreStateless
