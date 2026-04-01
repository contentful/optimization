import type {
  ApiClientConfig,
  ExperienceApiClientRequestOptions,
} from '@contentful/optimization-api-client'
import type { CoreStatelessApiConfig } from './CoreApiConfig'
import CoreBase, { type CoreConfig } from './CoreBase'
import { CoreStatelessRequestScope } from './CoreStatelessRequestScope'
import type { EventBuilderConfig } from './events'

/**
 * Request-bound Experience API options for stateless runtimes.
 *
 * @public
 */
export interface CoreStatelessRequestOptions extends Pick<
  ExperienceApiClientRequestOptions,
  'ip' | 'locale' | 'plainText' | 'preflight'
> {}

/**
 * Configuration for stateless Optimization Core runtimes.
 *
 * @public
 * @remarks
 * This configuration extends {@link CoreConfig} but allows partial overrides
 * of the event-builder configuration. SDKs commonly inject their own library
 * metadata or channel definitions.
 */
export interface CoreStatelessConfig extends CoreConfig {
  /**
   * Unified API configuration for stateless environments.
   */
  api?: CoreStatelessApiConfig

  /**
   * Overrides for the event builder configuration. Omits methods that are only
   * useful in stateful environments.
   */
  eventBuilder?: Omit<EventBuilderConfig, 'getLocale' | 'getPageProperties' | 'getUserAgent'>
}

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

const createStatelessExperienceApiConfig = (
  api: CoreStatelessConfig['api'] | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined) return undefined

  const experienceConfig = {
    baseUrl: api.experienceBaseUrl,
    enabledFeatures: api.enabledFeatures,
  }

  return hasDefinedValues(experienceConfig) ? experienceConfig : undefined
}

const createStatelessInsightsApiConfig = (
  api: CoreStatelessConfig['api'] | undefined,
): ApiClientConfig['insights'] => {
  if (api?.insightsBaseUrl === undefined) return undefined

  return {
    baseUrl: api.insightsBaseUrl,
  }
}

/**
 * Core runtime for stateless environments.
 *
 * @public
 * Built on top of `CoreBase`. Request-emitting methods are exposed through
 * {@link CoreStateless.forRequest}.
 */
class CoreStateless extends CoreBase<CoreStatelessConfig> {
  constructor(config: CoreStatelessConfig) {
    super(config, {
      experience: createStatelessExperienceApiConfig(config.api),
      insights: createStatelessInsightsApiConfig(config.api),
    })
  }

  /**
   * Bind request-scoped Experience API options for a single stateless request.
   *
   * @param options - Request-scoped Experience API options.
   * @returns A lightweight request scope for stateless event emission.
   */
  forRequest(options: CoreStatelessRequestOptions = {}): CoreStatelessRequestScope {
    return new CoreStatelessRequestScope(this, options)
  }
}

export { CoreStatelessRequestScope }

export default CoreStateless
