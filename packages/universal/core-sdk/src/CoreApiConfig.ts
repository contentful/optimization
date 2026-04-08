import type {
  ExperienceApiClientConfig,
  InsightsApiClientConfig,
} from '@contentful/optimization-api-client'

/**
 * Shared API configuration for all Core runtimes.
 *
 * @public
 */
export interface CoreSharedApiConfig {
  /** Base URL override for Experience API requests. */
  experienceBaseUrl?: ExperienceApiClientConfig['baseUrl']
  /** Base URL override for Insights API requests. */
  insightsBaseUrl?: InsightsApiClientConfig['baseUrl']
  /** Experience API features enabled for outgoing requests. */
  enabledFeatures?: ExperienceApiClientConfig['enabledFeatures']
}

/**
 * API configuration for stateful Core runtimes.
 *
 * @public
 */
export interface CoreStatefulApiConfig extends CoreSharedApiConfig {
  /** Beacon-like handler used by Insights event delivery when available. */
  beaconHandler?: InsightsApiClientConfig['beaconHandler']
  /** Experience API IP override. */
  ip?: ExperienceApiClientConfig['ip']
  /** Experience API locale override. */
  locale?: ExperienceApiClientConfig['locale']
  /** Experience API plain-text request toggle. */
  plainText?: ExperienceApiClientConfig['plainText']
  /** Experience API preflight request toggle. */
  preflight?: ExperienceApiClientConfig['preflight']
}

/**
 * API configuration for stateless Core runtimes.
 *
 * @public
 */
export interface CoreStatelessApiConfig extends CoreSharedApiConfig {}

/**
 * API configuration union for Core runtimes.
 *
 * @public
 */
export type CoreApiConfig = CoreStatefulApiConfig | CoreStatelessApiConfig
