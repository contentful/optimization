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
import type { ChainModifiers, Entry, EntryQueries, EntrySkeletonType, LocaleCode } from 'contentful'
import { OPTIMIZATION_CORE_SDK_NAME, OPTIMIZATION_CORE_SDK_VERSION } from './constants'
import { EventBuilder, type EventBuilderConfig } from './events'
import { InterceptorManager } from './lib/interceptor'
import type { ResolvedData } from './resolvers'
import { FlagsResolver, MergeTagValueResolver, OptimizedEntryResolver } from './resolvers'

const DEFAULT_CONTENTFUL_ENTRY_CACHE_MAX_ENTRIES = 100
const DEFAULT_CONTENTFUL_ENTRY_CACHE_TTL_MS = 300_000
const DEFAULT_CONTENTFUL_ENTRY_INCLUDE = 10

/**
 * Query shape used for SDK-managed `contentful.js` `getEntry()` calls.
 *
 * @public
 */
export type ContentfulEntryQuery = EntryQueries<undefined>

type ManagedContentfulEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
> = Entry<S, undefined, L>

/**
 * Minimal `contentful.js` client surface required for SDK-managed entry fetching.
 *
 * @public
 */
export interface ContentfulEntryClient {
  /** Fetch a single Contentful entry by ID. */
  getEntry: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
}

/**
 * Cache options for SDK-managed Contentful entry fetching.
 *
 * @public
 */
export interface ContentfulEntryCacheOptions {
  /** Maximum number of entries retained per SDK instance. */
  maxEntries?: number
  /** Time, in milliseconds, before a cached entry is refetched. */
  ttlMs?: number
}

/**
 * SDK-managed Contentful entry fetching configuration.
 *
 * @public
 */
export interface ContentfulConfig {
  /** `contentful.js` client used for SDK-managed `getEntry()` calls. */
  client: ContentfulEntryClient
  /** Query merged into every SDK-managed `getEntry()` call. */
  defaultQuery?: ContentfulEntryQuery
  /**
   * Per-SDK-instance entry cache configuration.
   *
   * @remarks
   * Defaults to `{ maxEntries: 100, ttlMs: 300_000 }`. Set to `false` to disable caching.
   */
  cache?: false | ContentfulEntryCacheOptions
}

/**
 * Options for {@link CoreBase.fetchOptimizedEntry}.
 *
 * @public
 */
export interface FetchOptimizedEntryOptions {
  /** Per-call Contentful `getEntry()` query overrides. */
  query?: ContentfulEntryQuery
  /** Selected optimizations used for personalized entry resolution. */
  selectedOptimizations?: SelectedOptimizationArray
}

/**
 * Result returned by {@link CoreBase.fetchOptimizedEntry}.
 *
 * @public
 */
export interface FetchOptimizedEntryResult<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = undefined,
  L extends LocaleCode = LocaleCode,
> extends ResolvedData<S, M, L> {
  /** Baseline entry fetched from Contentful before optimization resolution. */
  baselineEntry: Entry<S, M, L>
}

type ResolvedContentfulEntryCacheOptions = readonly [maxEntries: number, ttlMs: number]
type ContentfulEntryCacheRecord = readonly [expiresAt: number, promise: Promise<Entry>]

function createContentfulEntryQuery(
  defaultQuery: ContentfulEntryQuery | undefined,
  query: ContentfulEntryQuery | undefined,
  locale: string | undefined,
): ContentfulEntryQuery {
  const mergedQuery: ContentfulEntryQuery = {
    ...defaultQuery,
    ...query,
  }

  mergedQuery.include ??= DEFAULT_CONTENTFUL_ENTRY_INCLUDE

  if (mergedQuery.locale === undefined && locale !== undefined) {
    mergedQuery.locale = locale
  }

  return mergedQuery
}

function evictEntryCache(cache: Map<string, ContentfulEntryCacheRecord>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next()
    if (oldestKey.done) break
    cache.delete(oldestKey.value)
  }
}

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
   * Default SDK locale used for Experience API requests and event context.
   */
  locale?: string

  /**
   * Event builder configuration (channel/library metadata, etc.).
   */
  eventBuilder?: EventBuilderConfig

  /**
   * Optional SDK-managed Contentful Delivery API entry fetching.
   *
   * @remarks
   * Existing manual `resolveOptimizedEntry()` usage remains supported. Configure this only when
   * callers want the SDK to call `contentful.js` `getEntry()` by entry ID.
   */
  contentful?: ContentfulConfig

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

  private resolvedLocale: string | undefined
  private readonly entryCache = new Map<string, ContentfulEntryCacheRecord>()
  private readonly entryCacheOptions: ResolvedContentfulEntryCacheOptions | undefined

  /** Current SDK locale for Experience API requests and event context. */
  get locale(): string | undefined {
    return this.resolvedLocale
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
  constructor(config: TConfig, api: CoreBaseApiClientConfig = {}, locale?: string) {
    this.config = config
    this.resolvedLocale = locale
    const cache = config.contentful?.cache
    this.entryCacheOptions =
      cache === false
        ? undefined
        : [
            cache?.maxEntries ?? DEFAULT_CONTENTFUL_ENTRY_CACHE_MAX_ENTRIES,
            cache?.ttlMs ?? DEFAULT_CONTENTFUL_ENTRY_CACHE_TTL_MS,
          ]

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

    const resolvedEventBuilder = eventBuilder ?? {
      channel: 'server',
      library: { name: OPTIMIZATION_CORE_SDK_NAME, version: OPTIMIZATION_CORE_SDK_VERSION },
    }

    this.eventBuilder = new EventBuilder({
      ...resolvedEventBuilder,
      getLocale: resolvedEventBuilder.getLocale ?? (() => this.locale),
    })
  }

  protected setResolvedLocale(locale: string | undefined): void {
    this.resolvedLocale = locale
  }

  /**
   * Clear SDK-managed Contentful entry cache entries for this SDK instance.
   *
   * @public
   */
  clearContentfulEntryCache(): void {
    this.entryCache.clear()
  }

  /**
   * Fetch a Contentful entry through the configured `contentful.js` client.
   *
   * @param entryId - Contentful entry ID to fetch.
   * @param query - Per-call `getEntry()` query overrides.
   * @returns The Contentful entry returned by the configured client.
   *
   * @remarks
   * The SDK merges `contentful.defaultQuery`, the per-call query, SDK locale fallback, and
   * `include: 10` before calling `getEntry()`. By default, results are cached per SDK instance.
   */
  async fetchContentfulEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(entryId: string, query?: ContentfulEntryQuery): Promise<ManagedContentfulEntry<S, L>>
  async fetchContentfulEntry(entryId: string, query?: ContentfulEntryQuery): Promise<Entry> {
    const { client } = this.config.contentful ?? {}

    if (!client) {
      throw new Error('fetchContentfulEntry() requires contentful.client in SDK config.')
    }

    const { locale } = this
    const mergedQuery = createContentfulEntryQuery(
      this.config.contentful?.defaultQuery,
      query,
      locale,
    )
    const { entryCacheOptions: cacheOptions } = this

    if (cacheOptions === undefined) {
      return await client.getEntry(entryId, mergedQuery)
    }

    const now = Date.now()
    const cacheKey = `${entryId}:${JSON.stringify(mergedQuery)}`
    const cached = this.entryCache.get(cacheKey)

    if (cached && cached[0] > now) {
      this.entryCache.delete(cacheKey)
      this.entryCache.set(cacheKey, cached)
      return await cached[1]
    }

    if (cached) {
      this.entryCache.delete(cacheKey)
    }

    const promise = client.getEntry(entryId, mergedQuery)
    const cacheRecord: ContentfulEntryCacheRecord = [now + cacheOptions[1], promise]

    this.entryCache.set(cacheKey, cacheRecord)
    evictEntryCache(this.entryCache, cacheOptions[0])

    try {
      return await promise
    } catch (error) {
      if (this.entryCache.get(cacheKey) === cacheRecord) {
        this.entryCache.delete(cacheKey)
      }

      throw error
    }
  }

  /**
   * Fetch a Contentful entry and resolve its optimized variant.
   *
   * @param entryId - Contentful entry ID to fetch.
   * @param options - Per-call Contentful query and selected optimizations.
   * @returns Baseline entry, resolved entry, and optimization metadata.
   *
   * @remarks
   * This is additive to the synchronous `resolveOptimizedEntry()` API.
   */
  async fetchOptimizedEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entryId: string,
    options?: FetchOptimizedEntryOptions,
  ): Promise<FetchOptimizedEntryResult<S, undefined, L>>
  async fetchOptimizedEntry(
    entryId: string,
    options: FetchOptimizedEntryOptions = {},
  ): Promise<FetchOptimizedEntryResult<EntrySkeletonType, ChainModifiers>> {
    const baselineEntry = await this.fetchContentfulEntry(entryId, options.query)
    const resolvedData = this.resolveOptimizedEntry(baselineEntry, options.selectedOptimizations)

    return {
      baselineEntry,
      ...resolvedData,
    }
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
   * @remarks
   * This helper is intended for request-local resolution. When the supplied
   * entry comes from a shared application cache, avoid mutating the returned
   * entry in place unless you first clone it.
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
   * @remarks
   * Use this during request rendering with the current profile. The resolved
   * value is profile-dependent and is not safe for shared-output caching.
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
