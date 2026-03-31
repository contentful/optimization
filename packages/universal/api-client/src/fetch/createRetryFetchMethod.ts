import { createScopedLogger } from '../logger'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'

const logger = createScopedLogger('ApiClient:Retry')

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
 * @remarks
 * This value is currently fixed to `503 Service Unavailable`.
 *
 * @internal
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
 *
 * @public
 */
export interface RetryFetchMethodOptions extends BaseFetchMethodOptions {
  /**
   * Delay (in milliseconds) between retry attempts.
   *
   * @defaultValue `0`
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
   * @defaultValue `1`
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
 * Creates a callback function used by the retry loop to perform a protected fetch attempt.
 *
 * @param options - Internal options controlling request execution and retry classification.
 * @returns A function that performs one fetch attempt and either:
 * - returns a successful {@link Response},
 * - throws {@link HttpError} for retriable `503` responses, or
 * - aborts and returns `undefined` for non-retriable failures.
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
        const httpError = new Error(
          `Request to "${url.toString()}" failed with status: [${response.status}] ${response.statusText} - traceparent: ${response.headers.get('traceparent')}`,
        )
        logger.error('Request failed with non-OK status:', httpError)

        controller.abort()

        return
      }

      logger.debug(`Response from "${url.toString()}":`, response)

      return response
    } catch (error) {
      if (error instanceof HttpError && error.status === RETRY_RESPONSE_STATUS) {
        throw error
      }

      logger.error(`Request to "${url.toString()}" failed:`, error)

      controller.abort()
    }
  }
}

/**
 * Waits for the configured retry delay between attempts.
 *
 * @param intervalTimeout - Delay in milliseconds before the next retry attempt.
 * @returns A promise that resolves immediately when delay is non-positive,
 * otherwise after the timeout elapses.
 *
 * @internal
 */
async function delayRetry(intervalTimeout: number): Promise<void> {
  if (intervalTimeout <= 0) {
    return
  }

  const { promise, resolve } = Promise.withResolvers<undefined>()
  setTimeout(() => {
    resolve(undefined)
  }, intervalTimeout)
  await promise
}

/**
 * Creates a {@link FetchMethod} that retries failed requests according to the
 * provided configuration.
 *
 * @param options - Configuration options that control retry behavior.
 * @returns A {@link FetchMethod} that automatically retries qualifying failures.
 *
 * @throws Error
 * Thrown when the request cannot be retried and no successful response is obtained.
 *
 * @remarks
 * This wrapper uses a lightweight internal retry loop and an {@link AbortController}
 * to cancel pending requests when a non-retriable error occurs.
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
 *
 * @public
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
    const maxAttempts = retries + 1
    const attemptFetch = createRetryFetchCallback({
      apiName,
      controller,
      fetchMethod,
      init,
      url,
    })

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
      try {
        const response = await attemptFetch()

        if (response) {
          return response
        }

        break
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== RETRY_RESPONSE_STATUS) {
          throw error
        }

        const retriesLeft = maxAttempts - attemptNumber

        onFailedAttempt?.({
          apiName,
          error,
          attemptNumber,
          retriesLeft,
        } satisfies FetchMethodCallbackOptions)

        if (retriesLeft === 0) {
          throw error
        }

        await delayRetry(intervalTimeout)
      }
    }

    throw new Error(`${apiName} API request to "${url.toString()}" may not be retried.`)
  }
}
