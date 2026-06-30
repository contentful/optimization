import { createScopedLogger } from '../logger'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'
import { fetchInputToString } from './fetchInputToString'
import { resolveFetchMethod } from './resolveFetchMethod'

const logger = createScopedLogger('ApiClient:Timeout')

/**
 * Default timeout (in milliseconds) for outgoing requests.
 *
 * @internal
 */
const DEFAULT_REQUEST_TIMEOUT = 3000

/** @internal */
function isFetchAbortSignal(signal: unknown): signal is NonNullable<RequestInit['signal']> {
  return typeof signal === 'object' && signal !== null
}

/**
 * Configuration options for {@link createTimeoutFetchMethod}.
 *
 * @public
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
   * @defaultValue `3000`
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
 * If `onRequestTimeout` is not provided, an error is logged by the package logger.
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
 *
 * @public
 */
export function createTimeoutFetchMethod({
  apiName = 'Optimization',
  fetchMethod,
  onRequestTimeout,
  requestTimeout = DEFAULT_REQUEST_TIMEOUT,
}: TimeoutFetchMethodOptions = {}): FetchMethod {
  const resolvedFetchMethod = resolveFetchMethod(fetchMethod)

  return async (url, init) => {
    const controller = new AbortController()

    const id = setTimeout(() => {
      if (typeof onRequestTimeout === 'function') {
        onRequestTimeout({ apiName })
      } else {
        logger.error(
          `Request to "${fetchInputToString(url)}" timed out`,
          new Error('Request timeout'),
        )
      }

      controller.abort()
    }, requestTimeout)

    const { signal } = controller

    if (!isFetchAbortSignal(signal)) {
      throw new Error('AbortController signal is not compatible with fetch.')
    }

    const requestInit = { ...init, signal }

    const response = await resolvedFetchMethod(url, requestInit)

    clearTimeout(id)

    return response
  }
}
