import { logger } from 'logger'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'

/**
 * Default timeout (in milliseconds) for outgoing requests.
 *
 * @internal
 */
const DEFAULT_REQUEST_TIMEOUT = 3000

/**
 * Configuration options for {@link createTimeoutFetchMethod}.
 */
export interface TimeoutFetchMethodOptions extends BaseFetchMethodOptions {
  /**
   * Callback invoked when a request exceeds the configured timeout.
   *
   * @param options - Information about the timed-out request.
   *
   * @remarks
   * If this callback is not provided, a default error is logged.
   *
   * @see {@link FetchMethodCallbackOptions}
   */
  onRequestTimeout?: (options: FetchMethodCallbackOptions) => void

  /**
   * Maximum time (in milliseconds) to wait for a response before aborting the request.
   *
   * @remarks
   * Defaults to {@link DEFAULT_REQUEST_TIMEOUT}.
   */
  requestTimeout?: number
}

/**
 * Creates a {@link FetchMethod} that aborts requests after a configurable timeout.
 *
 * @param options - Configuration options controlling timeout behavior.
 * @returns A {@link FetchMethod} that enforces a timeout for each request.
 *
 * @remarks
 * When a timeout occurs, the request is aborted using an {@link AbortController}.
 * If `onRequestTimeout` is not provided, an error is logged by the {@link logger}.
 *
 * @example
 * ```ts
 * const fetchWithTimeout = createTimeoutFetchMethod({
 *   apiName: 'Optimization',
 *   requestTimeout: 5000,
 *   onRequestTimeout: ({ apiName }) => {
 *     console.warn(`${apiName} request timed out`)
 *   },
 * })
 *
 * const response = await fetchWithTimeout('https://example.com', { method: 'GET' })
 * ```
 *
 * @see {@link TimeoutFetchMethodOptions}
 */
export function createTimeoutFetchMethod({
  apiName = 'Optimization',
  fetchMethod = fetch,
  onRequestTimeout,
  requestTimeout = DEFAULT_REQUEST_TIMEOUT,
}: TimeoutFetchMethodOptions = {}): FetchMethod {
  return async (url: string | URL, init: RequestInit) => {
    const controller = new AbortController()

    const id = setTimeout(() => {
      if (typeof onRequestTimeout === 'function') {
        onRequestTimeout({ apiName })
      } else {
        logger.error(new Error(`${apiName} API request to "${url.toString()}" timed out.`))
      }

      controller.abort()
    }, requestTimeout)

    const response = await fetchMethod(url, { ...init, signal: controller.signal })

    clearTimeout(id)

    return response
  }
}
