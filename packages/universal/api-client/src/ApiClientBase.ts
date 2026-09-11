import Fetch, { type FetchMethod, type ProtectedFetchMethodOptions } from './fetch'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('ApiClient')

/**
 * Default Ninetailed/Optimization environment used when none is explicitly provided.
 *
 * @internal
 */
const DEFAULT_ENVIRONMENT = 'main'

/**
 * Default Contentful space environment used when none is explicitly provided.
 *
 * @internal
 */
const DEFAULT_CONTENTFUL_ENVIRONMENT = 'master'

/**
 * Configuration options for API clients extending `ApiClientBase`.
 *
 * @public
 */
export interface ApiConfig {
  /**
   * Base URL for the API.
   *
   * @remarks
   * When omitted, the concrete client is expected to construct full URLs
   * internally.
   */
  baseUrl?: string

  /**
   * Ninetailed/Optimization environment identifier.
   *
   * @remarks
   * Used by the legacy v1 Insights ingest API. This is a distinct value from
   * {@link ApiConfig.contentfulEnvironment}, which the v3 Experience API uses.
   *
   * @defaultValue `'main'`
   */
  environment?: string

  /**
   * Contentful space environment identifier.
   *
   * @remarks
   * Used by the v3 Experience API's `/environments/{contentfulEnvironment}/`
   * path segment. This is a distinct value from {@link ApiConfig.environment},
   * which the legacy v1 Insights API uses.
   *
   * @defaultValue `'master'`
   */
  contentfulEnvironment?: string

  /**
   * Options used to configure the underlying protected fetch method.
   *
   * @remarks
   * `apiName` is derived from the client name and must not be provided here.
   */
  fetchOptions?: Omit<ProtectedFetchMethodOptions, 'apiName'>

  /**
   * Contentful Space identifier used for authentication or tracking.
   */
  spaceId: string

  /**
   * Client identifier used for authentication or tracking.
   */
  clientId: string
}

/**
 * Properties that can be shared between global and per-client API configuration.
 *
 * @public
 */
export type GlobalApiConfigProperties =
  | 'environment'
  | 'contentfulEnvironment'
  | 'fetchOptions'
  | 'spaceId'
  | 'clientId'

/**
 * Base class for API clients that provides shared configuration and error logging.
 *
 * @remarks
 * This abstract class is intended for internal use within the package and
 * must not be treated as part of the public API surface.
 *
 * Concrete API clients must extend this class to inherit consistent logging
 * behavior and fetch configuration.
 *
 * @example
 * ```ts
 * interface MyClientConfig extends ApiConfig {
 *   // additional config
 * }
 *
 * class MyClient extends ApiClientBase {
 *   constructor(config: MyClientConfig) {
 *     super('MyClient', config)
 *   }
 *
 *   async getSomething() {
 *     const response = await this.fetch('https://example.com', { method: 'GET' })
 *     return response.json()
 *   }
 * }
 * ```
 *
 * @internal
 */
abstract class ApiClientBase {
  /**
   * Name of the API client, used in log messages and as the `apiName` for fetch.
   */
  protected readonly name: string

  /**
   * Contentful Space identifier used for authentication or tracking.
   */
  protected readonly spaceId: string

  /**
   * Client identifier used for authentication or tracking.
   */
  protected readonly clientId: string

  /**
   * Ninetailed/Optimization environment associated with this client.
   */
  protected readonly environment: string

  /**
   * Contentful space environment associated with this client.
   */
  protected readonly contentfulEnvironment: string

  /**
   * Protected fetch method used by the client to perform HTTP requests.
   */
  protected readonly fetch: FetchMethod

  /**
   * Creates a new API client base instance.
   *
   * @param name - Human-readable name of the client (used for logging and `apiName`).
   * @param config - Configuration options for the client.
   */
  constructor(
    name: string,
    { fetchOptions, spaceId, clientId, environment, contentfulEnvironment }: ApiConfig,
  ) {
    this.spaceId = spaceId
    this.clientId = clientId
    this.environment = environment ?? DEFAULT_ENVIRONMENT
    this.contentfulEnvironment = contentfulEnvironment ?? DEFAULT_CONTENTFUL_ENVIRONMENT
    this.name = name

    this.fetch = Fetch.create({ ...(fetchOptions ?? {}), apiName: name })
  }

  /**
   * Logs errors that occur during API requests with standardized messages.
   *
   * @param error - The error thrown by the underlying operation.
   * @param options - Additional metadata about the request.
   * @param options.requestName - Human-readable name of the request operation.
   *
   * @remarks
   * Abort errors are logged at `warn` level and other errors at `error` level.
   * The log message includes the client name for better debugging context.
   */
  protected logRequestError(error: unknown, { requestName }: { requestName: string }): void {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.warn(
          `[${this.name}] "${requestName}" request aborted due to network issues. This request may not be retried.`,
        )
      } else {
        logger.error(`[${this.name}] "${requestName}" request failed:`, error)
      }
    }
  }
}

export default ApiClientBase
