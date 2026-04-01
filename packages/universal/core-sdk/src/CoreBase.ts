import {
  ApiClient,
  type ApiClientConfig,
  type GlobalApiConfigProperties,
} from '@contentful/optimization-api-client'
import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  InsightsEvent as InsightsEventPayload,
  Json,
  MergeTagEntry,
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { LogLevels } from '@contentful/optimization-api-client/logger'
import { ConsoleLogSink, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { OPTIMIZATION_CORE_SDK_NAME, OPTIMIZATION_CORE_SDK_VERSION } from './constants'
import { EventBuilder, type EventBuilderConfig } from './events'
import { InterceptorManager } from './lib/interceptor'
import type { ResolvedData } from './resolvers'
import { FlagsResolver, MergeTagValueResolver, OptimizedEntryResolver } from './resolvers'

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
 * Options for configuring the `CoreBase` runtime and underlying clients.
 *
 * @public
 */
export interface CoreConfig extends Pick<ApiClientConfig, GlobalApiConfigProperties> {
  /**
   * Event builder configuration (channel/library metadata, etc.).
   */
  eventBuilder?: EventBuilderConfig

  /** Minimum log level for the default console sink. */
  logLevel?: LogLevels
}

interface CoreBaseApiClientConfig {
  experience?: ApiClientConfig['experience']
  insights?: ApiClientConfig['insights']
}

/**
 * Internal base that wires the API client, event builder, and logging.
 *
 * @internal
 */
abstract class CoreBase<TConfig extends CoreConfig = CoreConfig> {
  /** Shared Optimization API client instance. */
  readonly api: ApiClient
  /** Shared event builder instance. */
  readonly eventBuilder: EventBuilder
  /** Resolved core configuration. */
  readonly config: TConfig
  /** Static resolver for evaluating optimized custom flags. */
  readonly flagsResolver = FlagsResolver
  /** Static resolver for merge-tag lookups against profile data. */
  readonly mergeTagValueResolver = MergeTagValueResolver
  /** Static resolver for optimized Contentful entries. */
  readonly optimizedEntryResolver = OptimizedEntryResolver

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
  constructor(config: TConfig, api: CoreBaseApiClientConfig = {}) {
    this.config = config

    const { eventBuilder, logLevel, environment, clientId, fetchOptions } = config

    logger.addSink(new ConsoleLogSink(logLevel))

    const apiConfig: ApiClientConfig = {
      clientId,
      environment,
      fetchOptions,
      experience: api.experience,
      insights: api.insights,
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
   * Resolve a Contentful entry to the appropriate optimized variant (or
   * return the baseline entry if no matching variant is selected).
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The baseline entry to resolve.
   * @param selectedOptimizations - Optional selected optimization array for the current profile.
   * @returns {@link ResolvedData} containing the resolved entry and
   *   selected optimization metadata (if any).
   * @example
   * ```ts
   * const { entry, selectedOptimization } = core.resolveOptimizedEntry(
   *   baselineEntry,
   *   data.selectedOptimizations,
   * )
   * ```
   */
  resolveOptimizedEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, undefined, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<S, undefined, L>
  resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): ResolvedData<S, M, L>
  resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<S, M, L> {
    return this.optimizedEntryResolver.resolve<S, M, L>(entry, selectedOptimizations)
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
}

export default CoreBase
