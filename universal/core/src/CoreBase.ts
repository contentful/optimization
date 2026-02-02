import {
  ApiClient,
  EventBuilder,
  type InsightsEvent as AnalyticsEvent,
  type ApiClientConfig,
  type ChangeArray,
  type ComponentViewBuilderArgs,
  type EventBuilderConfig,
  type ExperienceApiClientConfig,
  type GlobalApiConfigProperties,
  type IdentifyBuilderArgs,
  type InsightsApiClientConfig,
  type Json,
  type MergeTagEntry,
  type OptimizationData,
  type PageViewBuilderArgs,
  type PartialProfile,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
  type ScreenViewBuilderArgs,
  type SelectedPersonalizationArray,
  type TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type { LogLevels } from 'logger'
import { ConsoleLogSink, logger } from 'logger'
import type AnalyticsBase from './analytics/AnalyticsBase'
import { OPTIMIZATION_CORE_SDK_VERSION } from './global-constants'
import { InterceptorManager } from './lib/interceptor'
import type { ResolvedData } from './personalization'
import type PersonalizationBase from './personalization/PersonalizationBase'

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
abstract class CoreBase {
  /** Product implementation for analytics. */
  abstract readonly analytics: AnalyticsBase
  /** Product implementation for personalization. */
  abstract readonly personalization: PersonalizationBase

  /** Shared Optimization API client instance. */
  readonly api: ApiClient
  /** Shared event builder instance. */
  readonly eventBuilder: EventBuilder
  /** Resolved core configuration (minus any name metadata). */
  readonly config: Omit<CoreConfig, 'name'>

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

    const { analytics, personalization, eventBuilder, logLevel, environment, clientId } = config

    logger.addSink(new ConsoleLogSink(logLevel))

    const apiConfig = {
      ...analytics,
      ...personalization,
      clientId,
      environment,
    }

    this.api = new ApiClient(apiConfig)

    this.eventBuilder = new EventBuilder(
      eventBuilder ?? {
        channel: 'server',
        library: { name: 'Optimization Core', version: OPTIMIZATION_CORE_SDK_VERSION },
      },
    )
  }

  /**
   * Get the value of a custom flag derived from a set of optimization changes.
   *
   * @param name - The flag key to resolve.
   * @param changes - Optional change list to resolve from
   * @returns The resolved JSON value for the flag if available.
   * @remarks
   * This is a convenience wrapper around personalization’s flag resolution.
   */
  getCustomFlag(name: string, changes?: ChangeArray): Json {
    return this.personalization.getCustomFlag(name, changes)
  }

  /**
   * Resolve a Contentful entry to the appropriate personalized variant (or
   * return the baseline entry if no matching variant is selected).
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The baseline entry to resolve.
   * @param personalizations - Optional selection array for the current profile.
   * @returns {@link ResolvedData} containing the resolved entry and
   *   personalization metadata (if any).
   */
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, personalizations?: SelectedPersonalizationArray): ResolvedData<S, M, L> {
    return this.personalization.personalizeEntry<S, M, L>(entry, personalizations)
  }

  /**
   * Resolve a merge-tag value from the given entry node and profile.
   *
   * @param embeddedEntryNodeTarget - The merge-tag entry node to resolve.
   * @param profile - Optional profile used for value lookup.
   * @returns The resolved value (typically a string) or `undefined` if not found.
   */
  getMergeTagValue(embeddedEntryNodeTarget: MergeTagEntry, profile?: Profile): unknown {
    return this.personalization.getMergeTagValue(embeddedEntryNodeTarget, profile)
  }

  /**
   * Convenience wrapper for sending an `identify` event via personalization.
   *
   * @param payload - Identify builder arguments.
   * @returns The resulting {@link OptimizationData} for the identified user.
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    return await this.personalization.identify(payload)
  }

  /**
   * Convenience wrapper for sending a `page` event via personalization.
   *
   * @param payload - Page view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this page view.
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    return await this.personalization.page(payload)
  }

  /**
   * Convenience wrapper for sending a `screen` event via personalization.
   *
   * @param payload - Screen view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   */
  async screen(
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    return await this.personalization.screen(payload)
  }

  /**
   * Convenience wrapper for sending a custom `track` event via personalization.
   *
   * @param payload - Track builder arguments.
   * @returns The evaluated {@link OptimizationData} for this event.
   */
  async track(
    payload: TrackBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    return await this.personalization.track(payload)
  }

  /**
   * Track a component view in both personalization and analytics.
   *
   * @param payload - Component view builder arguments. When `payload.sticky` is
   *   `true`, the event will also be sent via personalization as a sticky
   *   component view.
   * @param duplicationScope - Optional string used to scope duplication used in Stateful
   * implementations
   * @returns A promise that resolves when all delegated calls complete.
   * @remarks
   * The sticky behavior is delegated to personalization; analytics is always
   * invoked regardless of `sticky`.
   */
  async trackComponentView(
    payload: ComponentViewBuilderArgs & { profile?: PartialProfile },
    duplicationScope?: string,
  ): Promise<OptimizationData | undefined> {
    if (payload.sticky) {
      return await this.personalization.trackComponentView(payload, duplicationScope)
    }

    await this.analytics.trackComponentView(payload, duplicationScope)
  }

  /**
   * Track a feature flag view via analytics.
   *
   * @param payload - Component view builder arguments used to build the flag view event.
   * @param duplicationScope - Optional string used to scope duplication used in Stateful
   * implementations
   * @returns A promise that resolves when processing completes.
   */
  async trackFlagView(payload: ComponentViewBuilderArgs, duplicationScope?: string): Promise<void> {
    await this.analytics.trackFlagView(payload, duplicationScope)
  }
}

export default CoreBase
