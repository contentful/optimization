import {
  ApiClient,
  type ApiClientConfig,
  type ExperienceApiClientConfig,
  type GlobalApiConfigProperties,
  type InsightsApiClientConfig,
} from '@contentful/optimization-api-client'
import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  Flags,
  Json,
  MergeTagEntry,
  OptimizationData,
  PartialProfile,
  ExperienceEvent as PersonalizationEvent,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { LogLevels } from '@contentful/optimization-api-client/logger'
import { ConsoleLogSink, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type AnalyticsBase from './analytics/AnalyticsBase'
import { OPTIMIZATION_CORE_SDK_NAME, OPTIMIZATION_CORE_SDK_VERSION } from './constants'
import {
  type ClickBuilderArgs,
  EventBuilder,
  type EventBuilderConfig,
  type HoverBuilderArgs,
  type IdentifyBuilderArgs,
  type PageViewBuilderArgs,
  type ScreenViewBuilderArgs,
  type TrackBuilderArgs,
  type ViewBuilderArgs,
} from './events'
import { InterceptorManager } from './lib/interceptor'
import type {
  FlagsResolver,
  MergeTagValueResolver,
  PersonalizationBase,
  PersonalizedEntryResolver,
  ResolvedData,
  ResolverMethods,
} from './personalization'

/**
 * Lifecycle container for event and state interceptors.
 *
 * @public
 */
export interface LifecycleInterceptors {
  /** Interceptors invoked for individual events prior to validation/sending. */
  event: InterceptorManager<AnalyticsEvent | PersonalizationEvent>
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
   * Configuration for the personalization (Experience) API client.
   */
  personalization?: Omit<ExperienceApiClientConfig, GlobalApiConfigProperties>

  /**
   * Configuration for the analytics (Insights) API client.
   */
  analytics?: Omit<InsightsApiClientConfig, GlobalApiConfigProperties>

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
abstract class CoreBase implements ResolverMethods {
  /** Product implementation for analytics. */
  protected abstract _analytics: AnalyticsBase
  /** Product implementation for personalization. */
  protected abstract _personalization: PersonalizationBase

  /** Shared Optimization API client instance. */
  readonly api: ApiClient
  /** Shared event builder instance. */
  readonly eventBuilder: EventBuilder
  /** Resolved core configuration (minus any name metadata). */
  readonly config: Omit<CoreConfig, 'name'>

  /** Lifecycle interceptors for events and state updates. */
  readonly interceptors: LifecycleInterceptors = {
    event: new InterceptorManager<AnalyticsEvent | PersonalizationEvent>(),
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

    const {
      analytics,
      personalization,
      eventBuilder,
      logLevel,
      environment,
      clientId,
      fetchOptions,
    } = config

    logger.addSink(new ConsoleLogSink(logLevel))

    const apiConfig: ApiClientConfig = {
      clientId,
      environment,
      fetchOptions,
      analytics,
      personalization,
    }

    this.api = new ApiClient(apiConfig)

    this.eventBuilder = new EventBuilder(
      eventBuilder ?? {
        channel: 'server',
        library: { name: OPTIMIZATION_CORE_SDK_NAME, version: OPTIMIZATION_CORE_SDK_VERSION },
      },
    )
  }

  /**
   * Static {@link FlagsResolver | resolver} for evaluating personalized
   * custom flags.
   */
  get flagsResolver(): typeof FlagsResolver {
    return this._personalization.flagsResolver
  }

  /**
   * Static {@link MergeTagValueResolver | resolver} that returns values
   * sourced from a user profile based on a Contentful Merge Tag entry.
   */
  get mergeTagValueResolver(): typeof MergeTagValueResolver {
    return this._personalization.mergeTagValueResolver
  }

  /**
   * Static {@link PersonalizedEntryResolver | resolver } for personalized
   * Contentful entries (e.g., entry variants targeted to a profile audience).
   *
   * @remarks
   * Used by higher-level personalization flows to materialize entry content
   * prior to event emission.
   */
  get personalizedEntryResolver(): typeof PersonalizedEntryResolver {
    return this._personalization.personalizedEntryResolver
  }

  /**
   * Get the value of a custom flag derived from a set of optimization changes.
   *
   * @param name - The flag key to resolve.
   * @param changes - Optional change list to resolve from.
   * @returns The resolved JSON value for the flag if available.
   * @remarks
   * This is a convenience wrapper around personalization’s flag resolution.
   * @example
   * ```ts
   * const darkMode = core.getCustomFlag('dark-mode', data.changes)
   * ```
   */
  getCustomFlag(name: string, changes?: ChangeArray): Json {
    return this._personalization.getCustomFlag(name, changes)
  }

  /**
   * Get all resolved custom flags derived from a set of optimization changes.
   *
   * @param changes - Optional change list to resolve from.
   * @returns The resolved custom flag map.
   * @remarks
   * This is a convenience wrapper around personalization’s flag resolution.
   * @example
   * ```ts
   * const flags = core.getCustomFlags(data.changes)
   * ```
   */
  getCustomFlags(changes?: ChangeArray): Flags {
    return this._personalization.getCustomFlags(changes)
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
    return this._personalization.personalizeEntry<S, M, L>(entry, selectedPersonalizations)
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
    return this._personalization.getMergeTagValue(embeddedEntryNodeTarget, profile)
  }

  /**
   * Convenience wrapper for sending an `identify` event via personalization.
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
    return await this._personalization.identify(payload)
  }

  /**
   * Convenience wrapper for sending a `page` event via personalization.
   *
   * @param payload - Page view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this page view.
   * @example
   * ```ts
   * const data = await core.page({ properties: { title: 'Home' } })
   * ```
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    return await this._personalization.page(payload)
  }

  /**
   * Convenience wrapper for sending a `screen` event via personalization.
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
    return await this._personalization.screen(payload)
  }

  /**
   * Convenience wrapper for sending a custom `track` event via personalization.
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
    return await this._personalization.track(payload)
  }

  /**
   * Track a component view in both personalization and analytics.
   *
   * @param payload - Component view builder arguments. When `payload.sticky` is
   *   `true`, the event will also be sent via personalization as a sticky
   *   component view.
   * @returns A promise that resolves when all delegated calls complete.
   * @remarks
   * The sticky behavior is delegated to personalization; analytics is always
   * invoked regardless of `sticky`.
   * @example
   * ```ts
   * await core.trackView({ componentId: 'hero-banner', sticky: true })
   * ```
   */
  async trackView(
    payload: ViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    if (payload.sticky) {
      return await this._personalization.trackView(payload)
    }

    await this._analytics.trackView(payload)
  }

  /**
   * Track a component click via analytics.
   *
   * @param payload - Component click builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackClick({ componentId: 'hero-banner' })
   * ```
   */
  async trackClick(payload: ClickBuilderArgs): Promise<void> {
    await this._analytics.trackClick(payload)
  }

  /**
   * Track a component hover via analytics.
   *
   * @param payload - Component hover builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackHover({ componentId: 'hero-banner' })
   * ```
   */
  async trackHover(payload: HoverBuilderArgs): Promise<void> {
    await this._analytics.trackHover(payload)
  }

  /**
   * Track a feature flag view via analytics.
   *
   * @param payload - Component view builder arguments used to build the flag view event.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  async trackFlagView(payload: ViewBuilderArgs): Promise<void> {
    await this._analytics.trackFlagView(payload)
  }
}

export default CoreBase
