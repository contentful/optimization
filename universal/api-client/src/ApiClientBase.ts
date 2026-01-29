import { createScopedLogger } from 'logger'
import Fetch, { type FetchMethod, type ProtectedFetchMethodOptions } from './fetch'

const logger = createScopedLogger('ApiClient')

/**
 * Default Contentful environment used when none is explicitly provided.
 *
 * @internal
 */
const DEFAULT_ENVIRONMENT = 'main'

/**
 * Configuration options for API clients extending {@link ApiClientBase}.
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
   * Contentful environment identifier.
   *
   * @remarks
   * Defaults to `main` when not provided.
   */
  environment?: string

  /**
   * Options used to configure the underlying protected fetch method.
   *
   * @remarks
   * `apiName` is derived from the client name and must not be provided here.
   */
  fetchOptions?: Omit<ProtectedFetchMethodOptions, 'apiName'>

  /**
   * Client identifier used for authentication or tracking.
   */
  clientId: string
}

/**
 * Properties that may be shared between global and per-client API configuration.
 *
 * @public
 */
export type GlobalApiConfigProperties = 'environment' | 'fetchOptions' | 'clientId'

/**
 * Base class for API clients that provides shared configuration and error logging.
 *
 * @internal
 *
 * @remarks
 * This abstract class is intended for internal use within the package and
 * should not be treated as part of the public API surface.
 *
 * Concrete API clients should extend this class to inherit consistent logging
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
 */
abstract class ApiClientBase {
  /**
   * Name of the API client, used in log messages and as the `apiName` for fetch.
   */
  protected readonly name: string

  /**
   * Client identifier used for authentication or tracking.
   */
  protected readonly clientId: string

  /**
   * Contentful environment associated with this client.
   */
  protected readonly environment: string

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
  constructor(name: string, { fetchOptions, clientId, environment }: ApiConfig) {
    this.clientId = clientId
    this.environment = environment ?? DEFAULT_ENVIRONMENT
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
   * @protected
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
        logger.error(
          `[${this.name}] "${requestName}" request failed with error: [${error.name}] ${error.message}`,
        )
      }
    }
  }
}

export default ApiClientBase
