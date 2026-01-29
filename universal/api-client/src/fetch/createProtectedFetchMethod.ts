import { logger } from 'logger'
import { createRetryFetchMethod, type RetryFetchMethodOptions } from './createRetryFetchMethod'
import {
  createTimeoutFetchMethod,
  type TimeoutFetchMethodOptions,
} from './createTimeoutFetchMethod'
import type { FetchMethod } from './Fetch'

const LOG_LOCATION = 'ApiClient:Fetch'

/**
 * Options for {@link createProtectedFetchMethod}, combining timeout and retry behavior.
 */
export interface ProtectedFetchMethodOptions
  extends RetryFetchMethodOptions,
    TimeoutFetchMethodOptions {}

/**
 * Creates a {@link FetchMethod} that combines timeout and retry protection.
 *
 * @param options - Configuration options for both timeout and retry behavior.
 * @returns A {@link FetchMethod} that applies timeout and retry logic to requests.
 *
 * @remarks
 * The resulting method first wraps the base fetch with a timeout (via
 * {@link createTimeoutFetchMethod}), then applies retry behavior (via
 * {@link createRetryFetchMethod}).
 *
 * If an error is thrown during configuration or request execution, it is logged
 * using {@link logger}.
 *
 * @throws {@link Error}
 * Rethrows the original error after logging, including abort errors.
 *
 * @example
 * ```ts
 * const fetchProtected = createProtectedFetchMethod({
 *   apiName: 'Optimization',
 *   requestTimeout: 4000,
 *   retries: 2,
 * })
 *
 * const response = await fetchProtected('https://example.com/experiences', {
 *   method: 'GET',
 * })
 * ```
 */
export function createProtectedFetchMethod(options: ProtectedFetchMethodOptions): FetchMethod {
  try {
    const timeoutFetchMethod = createTimeoutFetchMethod(options)
    const retryFetchMethod = createRetryFetchMethod({ ...options, fetchMethod: timeoutFetchMethod })

    return retryFetchMethod
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.warn(
          LOG_LOCATION,
          'Request aborted due to network issues. This request may not be retried.',
        )
      } else {
        logger.error(LOG_LOCATION, `Request failed with error: [${error.name}] ${error.message}`)
      }
    }
    throw error
  }
}
