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
  /**
   * Default request location for singular Experience API calls.
   * Request-bound location options replace this whole object; `{}` supplies an empty default.
   * Each event's context location remains independent and takes precedence at the API.
   */
  location?: ExperienceApiClientConfig['location']
}

/**
 * API configuration for stateful Core runtimes.
 *
 * @public
 */
export interface CoreStatefulApiConfig extends CoreSharedApiConfig {
  /** Experience API IP override. */
  ip?: ExperienceApiClientConfig['ip']
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
