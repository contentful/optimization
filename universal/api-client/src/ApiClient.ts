import type { ApiConfig, GlobalApiConfigProperties } from './ApiClientBase'
import ExperienceApiClient, { type ExperienceApiClientConfig } from './experience'
import InsightsApiClient, { type InsightsApiClientConfig } from './insights'

/**
 * Configuration for the high-level {@link ApiClient}.
 *
 * @public
 */
export interface ApiClientConfig extends Pick<ApiConfig, GlobalApiConfigProperties> {
  /**
   * Configuration for the personalization (Experience) API client.
   *
   * @remarks
   * Any properties shared with {@link ApiConfig} are taken from the top-level
   * config and overridden by this object when specified.
   */
  personalization?: Omit<ExperienceApiClientConfig, GlobalApiConfigProperties>

  /**
   * Configuration for the analytics (Insights) API client.
   *
   * @remarks
   * Any properties shared with {@link ApiConfig} are taken from the top-level
   * config and overridden by this object when specified.
   */
  analytics?: Omit<InsightsApiClientConfig, GlobalApiConfigProperties>
}

/**
 * Aggregated API client providing access to Experience and Insights APIs.
 *
 * @public
 *
 * @remarks
 * This client encapsulates shared configuration and exposes dedicated
 * sub-clients for personalization and analytics use cases.
 *
 * @example
 * ```ts
 * const client = new ApiClient({
 *   clientId: 'org-id',
 *   environment: 'main',
 *   preview: false,
 *   personalization: {
 *     // experience-specific overrides
 *   },
 *   analytics: {
 *     // insights-specific overrides
 *   },
 * })
 *
 * const profile = await client.experience.getProfile('profile-id')
 * const batch = await client.insights.upsertManyProfiles({ events: batchEvents })
 * ```
 */
export default class ApiClient {
  /**
   * Shared configuration applied to both Experience and Insights clients.
   */
  readonly config: ApiConfig

  /**
   * Client for personalization and experience-related operations.
   */
  readonly experience: ExperienceApiClient

  /**
   * Client for analytics and insights-related operations.
   */
  readonly insights: InsightsApiClient

  /**
   * Creates a new aggregated {@link ApiClient} instance.
   *
   * @param config - Global API client configuration with optional per-client overrides.
   */
  constructor(config: ApiClientConfig) {
    const { personalization, analytics, ...apiConfig } = config

    this.config = apiConfig

    this.experience = new ExperienceApiClient({
      ...apiConfig,
      ...personalization,
    })

    this.insights = new InsightsApiClient({
      ...apiConfig,
      ...analytics,
    })
  }
}
