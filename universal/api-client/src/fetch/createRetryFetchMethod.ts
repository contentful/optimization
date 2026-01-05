import { logger } from 'logger'
import retry from 'p-retry'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'

/**
 * Default interval (in milliseconds) between retry attempts.
 *
 * @internal
 */
const DEFAULT_INTERVAL_TIMEOUT = 0

/**
 * Default number of retry attempts.
 *
 * @internal
 */
const DEFAULT_RETRY_COUNT = 1

/**
 * HTTP status code that triggers a retry.
 *
 * @internal
 *
 * @remarks
 * This value is currently fixed to `503 Service Unavailable`.
 */
const RETRY_RESPONSE_STATUS = 503

/**
 * Default HTTP status code used for {@link HttpError}.
 *
 * @internal
 */
const HTTP_ERROR_RESPONSE_STATUS = 500

/**
 * Error type representing HTTP failures with an associated status code.
 *
 * @internal
 */
class HttpError extends Error {
  /**
   * The HTTP status code associated with the error.
   */
  public status: number

  /**
   * Creates a new {@link HttpError}.
   *
   * @param message - Description of the error.
   * @param status - HTTP status code associated with the error.
   */
  constructor(message: string, status: number = HTTP_ERROR_RESPONSE_STATUS) {
    super(message)
    Object.setPrototypeOf(this, HttpError.prototype)
    this.status = status
  }
}

/**
 * Configuration options for {@link createRetryFetchMethod}.
 */
export interface RetryFetchMethodOptions extends BaseFetchMethodOptions {
  /**
   * Delay (in milliseconds) between retry attempts.
   *
   * @remarks
   * Defaults to {@link DEFAULT_INTERVAL_TIMEOUT}.
   */
  intervalTimeout?: number

  /**
   * Callback invoked whenever a retry attempt fails.
   *
   * @param options - Information about the failed attempt.
   *
   * @remarks
   * This callback is invoked with additional metadata such as the attempt
   * number and the number of retries left.
   */
  onFailedAttempt?: (options: FetchMethodCallbackOptions) => void

  /**
   * Maximum number of retry attempts.
   *
   * @remarks
   * Defaults to {@link DEFAULT_RETRY_COUNT}.
   */
  retries?: number
}

/**
 * Internal configuration passed to the retry callback.
 *
 * @internal
 */
interface RetryFetchCallbackOptions extends RetryFetchMethodOptions {
  /**
   * Abort controller used to cancel the underlying fetch requests.
   */
  controller: AbortController

  /**
   * Initialization options passed to the `fetch` implementation.
   */
  init: RequestInit

  /**
   * Request URL.
   */
  url: string | URL
}

/**
 * Creates a callback function used by `p-retry` to perform a fetch with retry logic.
 *
 * @param options - Internal options controlling the retry behavior.
 * @returns A function that, when invoked, performs the fetch and applies retry rules.
 *
 * @internal
 */
function createRetryFetchCallback({
  apiName = 'Optimization',
  controller,
  fetchMethod = fetch,
  init,
  url,
}: RetryFetchCallbackOptions) {
  return async () => {
    try {
      const response = await fetchMethod(url, init)

      if (response.status === RETRY_RESPONSE_STATUS) {
        throw new HttpError(
          `${apiName} API request to "${url.toString()}" failed with status: "[${response.status}] ${response.statusText}".`,
          RETRY_RESPONSE_STATUS,
        )
      }

      if (!response.ok) {
        logger.error(
          `${apiName} API request to "${url.toString()}" failed with status: "[${response.status}] ${
            response.statusText
          } - traceparent: ${response.headers.get('traceparent')}"`,
        )

        controller.abort()

        return
      }

      logger.debug(`${apiName} API response from "${url.toString()}":`, response)

      return response
    } catch (error) {
      if (error instanceof HttpError && error.status === RETRY_RESPONSE_STATUS) {
        throw error
      }

      logger.error(
        error instanceof Error
          ? error.message
          : `${apiName} API request to "${url.toString()}" failed with an unknown error`,
      )

      controller.abort()
    }
  }
}

/**
 * Creates a {@link FetchMethod} that retries failed requests according to the
 * provided configuration.
 *
 * @param options - Configuration options that control retry behavior.
 * @returns A {@link FetchMethod} that automatically retries qualifying failures.
 *
 * @remarks
 * This wrapper integrates with `p-retry` and uses an {@link AbortController}
 * to cancel pending requests when a non-retriable error occurs.
 *
 * @throws {@link Error}
 * Thrown when the request cannot be retried and no successful response is obtained.
 *
 * @example
 * ```ts
 * const fetchWithRetry = createRetryFetchMethod({
 *   apiName: 'Optimization',
 *   retries: 3,
 *   intervalTimeout: 200,
 *   onFailedAttempt: ({ attemptNumber, retriesLeft }) => {
 *     console.warn(`Attempt ${attemptNumber} failed. Retries left: ${retriesLeft}`)
 *   },
 * })
 *
 * const response = await fetchWithRetry('https://example.com', { method: 'GET' })
 * ```
 */
export function createRetryFetchMethod({
  apiName = 'Optimization',
  fetchMethod = fetch,
  intervalTimeout = DEFAULT_INTERVAL_TIMEOUT,
  onFailedAttempt,
  retries = DEFAULT_RETRY_COUNT,
}: RetryFetchMethodOptions = {}): FetchMethod {
  return async (url: string | URL, init: RequestInit) => {
    const controller = new AbortController()

    let retryResponse: Response | undefined = undefined

    try {
      retryResponse = await retry<Response | undefined>(
        createRetryFetchCallback({ apiName, controller, fetchMethod, init, url }),
        {
          minTimeout: intervalTimeout,
          onFailedAttempt: (options: FetchMethodCallbackOptions) =>
            onFailedAttempt?.({ ...options, apiName }),
          retries,
          signal: controller.signal,
        },
      )
    } catch (error) {
      // Abort errors caused by timeouts should not bubble up and be reported by third-party tools (e.g. Sentry)
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        throw error
      }
    }

    if (!retryResponse) {
      throw new Error(`${apiName} API request to "${url.toString()}" may not be retried.`)
    }

    return retryResponse
  }
}
