import {
  ApiClient,
  type ApiClientConfig,
  type ExperienceApiClientConfig,
  type GlobalApiConfigProperties,
  type InsightsApiClientConfig,
} from '@contentful/optimization-api-client'
import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  ExperienceEventType,
  InsightsEvent as InsightsEventPayload,
  InsightsEventType,
  Json,
  MergeTagEntry,
  OptimizationData,
  PartialProfile,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { LogLevels } from '@contentful/optimization-api-client/logger'
import { ConsoleLogSink, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { OPTIMIZATION_CORE_SDK_NAME, OPTIMIZATION_CORE_SDK_VERSION } from './constants'
import {
  type ClickBuilderArgs,
  EventBuilder,
  type EventBuilderConfig,
  type FlagViewBuilderArgs,
  type HoverBuilderArgs,
  type IdentifyBuilderArgs,
  type PageViewBuilderArgs,
  type ScreenViewBuilderArgs,
  type TrackBuilderArgs,
  type ViewBuilderArgs,
} from './events'
import { InterceptorManager } from './lib/interceptor'
import type { ResolvedData } from './resolvers'
import { FlagsResolver, MergeTagValueResolver, PersonalizedEntryResolver } from './resolvers'

/**
 * Unified API configuration for Core.
 *
 * @public
 */
export interface CoreApiConfig {
  /** Base URL override for Experience API requests. */
  experienceBaseUrl?: ExperienceApiClientConfig['baseUrl']
  /** Base URL override for Insights API requests. */
  insightsBaseUrl?: InsightsApiClientConfig['baseUrl']
  /** Beacon-like handler used by Insights event delivery when available. */
  beaconHandler?: InsightsApiClientConfig['beaconHandler']
  /** Experience API features enabled for outgoing requests. */
  enabledFeatures?: ExperienceApiClientConfig['enabledFeatures']
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
 * Union of all event type keys that Core may emit.
 *
 * @public
 */
export type EventType = InsightsEventType | ExperienceEventType

/**
 * Lifecycle container for event and state interceptors.
 *
 * @public
 */
export interface LifecycleInterceptors {
  /** Interceptors invoked for individual events prior to validation/sending. */
  event: InterceptorManager<InsightsEventPayload | ExperienceEventPayload>
  /** Interceptors invoked before optimization state updates. */
  state: InterceptorManager<OptimizationData>
}

/**
 * Options for configuring the {@link CoreBase} runtime and underlying clients.
 *
 * @public
 */
export interface CoreConfig extends Pick<ApiClientConfig, GlobalApiConfigProperties> {
  /**
   * Unified API configuration used by Experience and Insights clients.
   */
  api?: CoreApiConfig

  /**
   * Event builder configuration (channel/library metadata, etc.).
   */
  eventBuilder?: EventBuilderConfig

  /** Minimum log level for the default console sink. */
  logLevel?: LogLevels
}

/**
 * Internal base that wires the API client, event builder, and logging.
 *
 * @internal
 */
abstract class CoreBase {
  /** Shared Optimization API client instance. */
  readonly api: ApiClient
  /** Shared event builder instance. */
  readonly eventBuilder: EventBuilder
  /** Resolved core configuration. */
  readonly config: CoreConfig
  /** Static resolver for evaluating personalized custom flags. */
  readonly flagsResolver = FlagsResolver
  /** Static resolver for merge-tag lookups against profile data. */
  readonly mergeTagValueResolver = MergeTagValueResolver
  /** Static resolver for personalized Contentful entries. */
  readonly personalizedEntryResolver = PersonalizedEntryResolver

  /** Lifecycle interceptors for events and state updates. */
  readonly interceptors: LifecycleInterceptors = {
    event: new InterceptorManager<InsightsEventPayload | ExperienceEventPayload>(),
    state: new InterceptorManager<OptimizationData>(),
  }

  /**
   * Create the core with API client and logging preconfigured.
   *
   * @param config - Core configuration including API and builder options.
   * @example
   * ```ts
   * const sdk = new CoreStateless({ clientId: 'abc123', environment: 'prod' })
   * ```
   */
  constructor(config: CoreConfig) {
    this.config = config

    const { api, eventBuilder, logLevel, environment, clientId, fetchOptions } = config

    logger.addSink(new ConsoleLogSink(logLevel))

    const apiConfig: ApiClientConfig = {
      clientId,
      environment,
      fetchOptions,
      analytics: CoreBase.createInsightsApiConfig(api),
      personalization: CoreBase.createExperienceApiConfig(api),
    }

    this.api = new ApiClient(apiConfig)

    this.eventBuilder = new EventBuilder(
      eventBuilder ?? {
        channel: 'server',
        library: { name: OPTIMIZATION_CORE_SDK_NAME, version: OPTIMIZATION_CORE_SDK_VERSION },
      },
    )
  }

  private static createExperienceApiConfig(
    api: CoreApiConfig | undefined,
  ): ApiClientConfig['personalization'] {
    if (api === undefined) return undefined

    const { enabledFeatures, experienceBaseUrl: baseUrl, ip, locale, plainText, preflight } = api

    if (
      baseUrl === undefined &&
      enabledFeatures === undefined &&
      ip === undefined &&
      locale === undefined &&
      plainText === undefined &&
      preflight === undefined
    ) {
      return undefined
    }

    return {
      baseUrl,
      enabledFeatures,
      ip,
      locale,
      plainText,
      preflight,
    }
  }

  private static createInsightsApiConfig(
    api: CoreApiConfig | undefined,
  ): ApiClientConfig['analytics'] {
    if (api === undefined) return undefined

    const { beaconHandler, insightsBaseUrl: baseUrl } = api

    if (baseUrl === undefined && beaconHandler === undefined) {
      return undefined
    }

    return { baseUrl, beaconHandler }
  }

  /**
   * Get the value of a custom flag derived from a set of optimization changes.
   *
   * @param name - The flag key to resolve.
   * @param changes - Optional change list to resolve from.
   * @returns The resolved JSON value for the flag if available.
   * @remarks
   * This is a convenience wrapper around Core's shared flag resolution.
   * @example
   * ```ts
   * const darkMode = core.getFlag('dark-mode', data.changes)
   * ```
   */
  getFlag(name: string, changes?: ChangeArray): Json {
    return this.flagsResolver.resolve(changes)[name]
  }

  /**
   * Resolve a Contentful entry to the appropriate personalized variant (or
   * return the baseline entry if no matching variant is selected).
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The baseline entry to resolve.
   * @param selectedPersonalizations - Optional selected personalization array for the current profile.
   * @returns {@link ResolvedData} containing the resolved entry and
   *   personalization metadata (if any).
   * @example
   * ```ts
   * const { entry, personalization } = core.personalizeEntry(baselineEntry, data.personalizations)
   * ```
   */
  personalizeEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, undefined, L>,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, undefined, L>
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, M, L>
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, M, L> {
    return this.personalizedEntryResolver.resolve<S, M, L>(entry, selectedPersonalizations)
  }

  /**
   * Resolve a merge-tag value from the given entry node and profile.
   *
   * @param embeddedEntryNodeTarget - The merge-tag entry node to resolve.
   * @param profile - Optional profile used for value lookup.
   * @returns The resolved value (typically a string) or `undefined` if not found.
   * @example
   * ```ts
   * const name = core.getMergeTagValue(mergeTagNode, profile)
   * ```
   */
  getMergeTagValue(embeddedEntryNodeTarget: MergeTagEntry, profile?: Profile): string | undefined {
    return this.mergeTagValueResolver.resolve(embeddedEntryNodeTarget, profile)
  }

  protected abstract sendExperienceEvent(
    method: string,
    args: readonly unknown[],
    event: ExperienceEventPayload,
    profile?: PartialProfile,
  ): Promise<OptimizationData | undefined>

  protected abstract sendInsightsEvent(
    method: string,
    args: readonly unknown[],
    event: InsightsEventPayload,
    profile?: PartialProfile,
  ): Promise<void>

  /**
   * Convenience wrapper for sending an `identify` event through the Experience path.
   *
   * @param payload - Identify builder arguments.
   * @returns The resulting {@link OptimizationData} for the identified user.
   * @example
   * ```ts
   * const data = await core.identify({ userId: 'user-123', traits: { plan: 'pro' } })
   * ```
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      'identify',
      [payload],
      this.eventBuilder.buildIdentify(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a `page` event through the Experience path.
   *
   * @param payload - Page view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this page view.
   * @example
   * ```ts
   * const data = await core.page({ properties: { title: 'Home' } })
   * ```
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile } = {},
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      'page',
      [payload],
      this.eventBuilder.buildPageView(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a `screen` event through the Experience path.
   *
   * @param payload - Screen view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   * @example
   * ```ts
   * const data = await core.screen({ name: 'HomeScreen' })
   * ```
   */
  async screen(
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      'screen',
      [payload],
      this.eventBuilder.buildScreenView(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a custom `track` event through the Experience path.
   *
   * @param payload - Track builder arguments.
   * @returns The evaluated {@link OptimizationData} for this event.
   * @example
   * ```ts
   * const data = await core.track({ event: 'button_click', properties: { label: 'Buy' } })
   * ```
   */
  async track(
    payload: TrackBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload

    return await this.sendExperienceEvent(
      'track',
      [payload],
      this.eventBuilder.buildTrack(builderArgs),
      profile,
    )
  }

  /**
   * Track a component view in both Experience and Insights.
   *
   * @param payload - Component view builder arguments. When `payload.sticky` is
   *   `true`, the event will also be sent through Experience as a sticky
   *   component view.
   * @returns A promise that resolves when all delegated calls complete.
   * @remarks
   * Experience receives sticky views only; Insights is always invoked regardless
   * of `sticky`.
   * @example
   * ```ts
   * await core.trackView({ componentId: 'hero-banner', sticky: true })
   * ```
   */
  async trackView(
    payload: ViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    let result = undefined

    if (payload.sticky) {
      result = await this.sendExperienceEvent(
        'trackView',
        [payload],
        this.eventBuilder.buildView(builderArgs),
        profile,
      )
    }

    await this.sendInsightsEvent(
      'trackView',
      [payload],
      this.eventBuilder.buildView(builderArgs),
      profile,
    )

    return result
  }

  /**
   * Track a component click through Insights.
   *
   * @param payload - Component click builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackClick({ componentId: 'hero-banner' })
   * ```
   */
  async trackClick(payload: ClickBuilderArgs): Promise<void> {
    await this.sendInsightsEvent('trackClick', [payload], this.eventBuilder.buildClick(payload))
  }

  /**
   * Track a component hover through Insights.
   *
   * @param payload - Component hover builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackHover({ componentId: 'hero-banner' })
   * ```
   */
  async trackHover(payload: HoverBuilderArgs): Promise<void> {
    await this.sendInsightsEvent('trackHover', [payload], this.eventBuilder.buildHover(payload))
  }

  /**
   * Track a feature flag view through Insights.
   *
   * @param payload - Component view builder arguments used to build the flag view event.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  async trackFlagView(payload: FlagViewBuilderArgs): Promise<void> {
    await this.sendInsightsEvent(
      'trackFlagView',
      [payload],
      this.eventBuilder.buildFlagView(payload),
    )
  }
}

export default CoreBase
