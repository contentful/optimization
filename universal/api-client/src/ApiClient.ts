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
   * Shared fields (`clientId`, `environment`, `fetchOptions`) are inherited
   * from top-level config; this object is for Experience-specific options.
   */
  personalization?: Omit<ExperienceApiClientConfig, GlobalApiConfigProperties>

  /**
   * Configuration for the analytics (Insights) API client.
   *
   * @remarks
   * Shared fields (`clientId`, `environment`, `fetchOptions`) are inherited
   * from top-level config; this object is for Insights-specific options.
   */
  analytics?: Omit<InsightsApiClientConfig, GlobalApiConfigProperties>
}

/**
 * Aggregated API client providing access to Experience and Insights APIs.
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
 *   personalization: {
 *     // experience-specific overrides
 *   },
 *   analytics: {
 *     // insights-specific overrides
 *   },
 * })
 *
 * const profile = await client.experience.getProfile('profile-id')
 * await client.insights.sendBatchEvents(batches)
 * ```
 *
 * @see {@link ExperienceApiClient}
 * @see {@link InsightsApiClient}
 *
 * @public
 */
export default class ApiClient {
  /**
   * Shared configuration applied to both Experience and Insights clients.
   *
   * @see {@link ApiConfig}
   */
  readonly config: ApiConfig

  /**
   * Client for personalization and experience-related operations.
   *
   * @see {@link ExperienceApiClient}
   */
  readonly experience: ExperienceApiClient

  /**
   * Client for analytics and insights-related operations.
   *
   * @see {@link InsightsApiClient}
   */
  readonly insights: InsightsApiClient

  /**
   * Creates a new aggregated {@link ApiClient} instance.
   *
   * @param config - Global API client configuration with optional per-client overrides.
   */
  constructor(config: ApiClientConfig) {
    const { personalization, analytics, clientId, environment, fetchOptions } = config
    const apiConfig: ApiConfig = {
      clientId,
      environment,
      fetchOptions,
    }

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
