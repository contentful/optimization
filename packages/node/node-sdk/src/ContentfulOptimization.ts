import {
  CoreStateless,
  normalizeLocale,
  resolveContentfulLocale,
  type CoreStatelessConfig,
  type EventType,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import { OPTIMIZATION_NODE_SDK_NAME, OPTIMIZATION_NODE_SDK_VERSION } from './constants'

const DEFAULT_RUNTIME_LOCALE = 'en-US'
const DEFAULT_ACCEPT_LANGUAGE_QUALITY = 1
const QUALITY_PARAM_PATTERN = /;\s*q=/
const DEFAULT_NODE_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page']

type NodeEventBuilderConfig = Partial<Omit<NonNullable<CoreStatelessConfig['eventBuilder']>, 'app'>>
type PublicNodeEventBuilderConfig = Omit<NodeEventBuilderConfig, 'getConsent'>

interface HeaderRequestLike {
  acceptsLanguages?: () => string[]
  get?: (name: string) => string | null | undefined
  headers?: unknown
}

/**
 * Locale pair resolved from an incoming server request.
 *
 * @public
 */
export interface ResolvedRequestLocale {
  /** Locale to place on SDK event context. */
  readonly eventLocale: string
  /** Contentful locale to use for CDA fetches and Experience API request options, when configured. */
  readonly contentfulLocale?: string
}

/**
 * Accepted inputs for {@link ContentfulOptimization.resolveRequestLocale}.
 *
 * @public
 */
export type RequestLocaleInput = string | null | undefined | HeaderRequestLike

/**
 * Configuration for the Node-specific ContentfulOptimization SDK.
 *
 * @remarks
 * This configuration extends {@link CoreStatelessConfig} but allows partial
 * overrides of the event-builder configuration. SDKs commonly inject their own
 * library metadata or channel definitions.
 *
 * @see {@link CoreStatelessConfig}
 *
 * @public
 */
export interface OptimizationNodeConfig extends Omit<CoreStatelessConfig, 'eventBuilder'> {
  /**
   * The application definition used to attribute events to a specific consumer app.
   *
   * @remarks
   * When not provided, events will not contain app metadata in their context.
   */
  app?: App

  /**
   * Partial overrides for the event builder configuration.
   *
   * @remarks
   * Any provided fields are merged with the default Node SDK metadata.
   * Request-scoped consent should be bound with `forRequest()`, not configured
   * on the SDK singleton.
   *
   * This differs from {@link CoreStatelessConfig} eventBuilder, which expects
   * a full configuration object.
   */
  eventBuilder?: PublicNodeEventBuilderConfig
}

function normalizeHeaderValue(header: unknown): string | undefined {
  if (typeof header === 'string') {
    return header
  }

  return Array.isArray(header)
    ? header.filter((item): item is string => typeof item === 'string').join(',')
    : undefined
}

function getAcceptLanguageHeader(input: RequestLocaleInput): string | undefined {
  if (typeof input === 'string') {
    return input
  }

  if (typeof input !== 'object' || input === null) {
    return undefined
  }

  const headerFromGetter = input.get?.('accept-language')

  if (typeof headerFromGetter === 'string') {
    return headerFromGetter
  }

  const { headers } = input

  if (typeof headers !== 'object' || headers === null) {
    return undefined
  }

  const get: unknown = Reflect.get(headers, 'get')
  const header: unknown =
    typeof get === 'function'
      ? Reflect.apply(get, headers, ['accept-language'])
      : (Reflect.get(headers, 'accept-language') ?? Reflect.get(headers, 'Accept-Language'))

  return normalizeHeaderValue(header)
}

function parseAcceptLanguage(acceptLanguage: string | undefined): string[] {
  const candidates: Array<{ index: number; locale: string; quality: number }> = []

  for (const [index, value] of (acceptLanguage ?? '').split(',').entries()) {
    const [rawLocale, rawQuality] = value.split(QUALITY_PARAM_PATTERN)
    const locale = normalizeLocale(rawLocale)

    if (locale === undefined) {
      continue
    }

    const parsedQuality =
      rawQuality === undefined ? DEFAULT_ACCEPT_LANGUAGE_QUALITY : Number(rawQuality)
    const quality = Number.isFinite(parsedQuality) ? parsedQuality : DEFAULT_ACCEPT_LANGUAGE_QUALITY

    if (quality > 0) {
      candidates.push({ index, locale, quality })
    }
  }

  return candidates
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map((candidate) => candidate.locale)
}

function getRequestLocaleCandidates(input: RequestLocaleInput): string[] {
  const parsedHeaderLocales = parseAcceptLanguage(getAcceptLanguageHeader(input))

  if (parsedHeaderLocales.length > 0) {
    return parsedHeaderLocales
  }

  if (typeof input !== 'object' || input === null) {
    return []
  }

  return (
    input
      .acceptsLanguages?.()
      .map(normalizeLocale)
      .filter((locale): locale is string => locale !== undefined) ?? []
  )
}

/**
 * Node-specific ContentfulOptimization SDK built on {@link CoreStateless}.
 *
 * @remarks
 * This class adapts the stateless ContentfulOptimization Core for Node runtimes by
 * applying environment-appropriate defaults (e.g., server channel, Node SDK
 * library metadata). No core runtime behavior is modified; only configuration
 * defaults differ.
 *
 * @example
 * ```ts
 * import ContentfulOptimization from '@contentful/optimization-node'
 *
 * const sdk = new ContentfulOptimization({
 *   clientId: 'abc-123',
 *   environment: 'main',
 *   logLevel: 'info',
 * })
 *
 * const requestOptimization = sdk.forRequest({
 *   consent: true,
 *   experienceOptions: { locale: 'fr-CA' },
 *   profile: { id: 'profile-id' },
 * })
 *
 * await requestOptimization.page()
 * ```
 *
 * @see {@link CoreStateless}
 *
 * @public
 */
class ContentfulOptimization extends CoreStateless {
  /**
   * Create an instance of the Node SDK with merged defaults.
   *
   * @param config - Partial Node-specific configuration. Any eventBuilder
   *                 fields provided are merged with Node's defaults.
   *
   * @example
   * ```ts
   * import ContentfulOptimization from '@contentful/optimization-node'
   *
   * const optimization = new ContentfulOptimization({ clientId: 'my-client-id' })
   * ```
   */
  constructor({ app, allowedEventTypes, eventBuilder, ...config }: OptimizationNodeConfig) {
    const {
      library,
      getConsent: _getConsent,
      ...eventBuilderConfig
    } = (eventBuilder ?? {}) as NodeEventBuilderConfig

    super({
      ...config,
      allowedEventTypes: allowedEventTypes ?? DEFAULT_NODE_ALLOWED_EVENT_TYPES,
      eventBuilder: {
        app,
        channel: 'server',
        library: {
          name: OPTIMIZATION_NODE_SDK_NAME,
          version: OPTIMIZATION_NODE_SDK_VERSION,
          ...library,
        },
        getConsent: () => false,
        ...eventBuilderConfig,
      },
    })
  }

  /**
   * Resolve request and Contentful locales from `Accept-Language`.
   *
   * @param input - Raw `Accept-Language` header or a request-like object.
   * @returns Event-context locale and Contentful CDA locale.
   *
   * @example
   * ```ts
   * const { eventLocale, contentfulLocale } = optimization.resolveRequestLocale(req)
   * ```
   */
  resolveRequestLocale(input: RequestLocaleInput): ResolvedRequestLocale {
    const candidates = getRequestLocaleCandidates(input)
    const eventLocale = candidates[0] ?? DEFAULT_RUNTIME_LOCALE
    const contentfulLocale =
      resolveContentfulLocale({
        candidates,
        contentfulLocales: this.config.contentfulLocales,
      }) ?? this.locale

    return contentfulLocale === undefined ? { eventLocale } : { eventLocale, contentfulLocale }
  }
}

export default ContentfulOptimization
