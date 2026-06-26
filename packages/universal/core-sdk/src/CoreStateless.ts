import type {
  ApiClientConfig,
  ExperienceApiClientRequestOptions,
  InsightsApiClientRequestOptions,
} from '@contentful/optimization-api-client'
import type { CoreStatelessApiConfig } from './CoreApiConfig'
import CoreBase, { type CoreConfig } from './CoreBase'
import { CoreStatelessRequest, type CoreStatelessForRequestOptions } from './CoreStatelessRequest'
import {
  DEFAULT_ALLOWED_EVENT_TYPES,
  type AllowedEventType,
  type BlockedEvent,
  type EventBuilderConfig,
} from './events'
import { normalizeExplicitLocale } from './locale'

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
 * Request-bound Insights API options for stateless runtimes.
 *
 * @public
 */
export interface CoreStatelessInsightsOptions extends Pick<
  InsightsApiClientRequestOptions,
  'beaconHandler'
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

  /**
   * Allow-listed event type strings permitted when request event consent is not granted.
   */
  allowedEventTypes?: AllowedEventType[]

  /**
   * Callback invoked whenever an event call is blocked by consent.
   */
  onEventBlocked?: (event: BlockedEvent) => void
}

export { CoreStatelessRequest } from './CoreStatelessRequest'
export type {
  CoreStatelessForRequestOptions,
  CoreStatelessRequestConsent,
  StatelessExperiencePayload,
  StatelessInsightsPayload,
  StatelessNonStickyTrackViewPayload,
  StatelessStickyTrackViewPayload,
} from './CoreStatelessRequest'
export type { AllowedEventType, EventType } from './events'

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

const createStatelessExperienceApiConfig = (
  api: CoreStatelessConfig['api'] | undefined,
  locale: string | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined && locale === undefined) return undefined

  const experienceConfig = {
    baseUrl: api?.experienceBaseUrl,
    enabledFeatures: api?.enabledFeatures,
    locale,
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
 * Built on top of `CoreBase`. Event-emitting methods are exposed on
 * request-bound clients created with {@link CoreStateless.forRequest}.
 * @remarks
 * The runtime itself is stateless, but request-bound event methods still perform outbound
 * Experience and Insights API calls. Cache Contentful delivery data in the
 * host application, not the results of those calls.
 */
class CoreStateless extends CoreBase {
  readonly allowedEventTypes: AllowedEventType[]
  readonly onEventBlocked?: CoreStatelessConfig['onEventBlocked']

  constructor(config: CoreStatelessConfig) {
    const { allowedEventTypes = DEFAULT_ALLOWED_EVENT_TYPES, onEventBlocked } = config
    const locale = normalizeExplicitLocale(config.locale)

    super(
      config,
      {
        experience: createStatelessExperienceApiConfig(config.api, locale),
        insights: createStatelessInsightsApiConfig(config.api),
      },
      locale,
    )

    this.allowedEventTypes = allowedEventTypes
    this.onEventBlocked = onEventBlocked
  }

  /**
   * Bind stateless SDK event calls to one incoming request.
   *
   * @param options - Request consent, profile, event context, and Experience API options.
   * @returns Request-bound event client.
   */
  forRequest(options: CoreStatelessForRequestOptions): CoreStatelessRequest {
    return new CoreStatelessRequest(this, options)
  }
}

export default CoreStateless
