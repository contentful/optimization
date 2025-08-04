import retry from 'p-retry'
import { logger } from '../../logger'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'

const DEFAULT_INTERVAL_TIMEOUT = 0
const DEFAULT_RETRY_COUNT = 1
const RETRY_RESPONSE_STATUS = 503
const HTTP_ERROR_RESPONSE_STATUS = 500

class HttpError extends Error {
  public status: number

  constructor(message: string, status: number = HTTP_ERROR_RESPONSE_STATUS) {
    super(message)
    Object.setPrototypeOf(this, HttpError.prototype)
    this.status = status
  }
}

export interface RetryFetchMethodOptions extends BaseFetchMethodOptions {
  intervalTimeout?: number
  onFailedAttempt?: (options: FetchMethodCallbackOptions) => void
  retries?: number
}

export function createRetryFetchMethod({
  apiName = 'Optimization',
  fetchMethod = fetch,
  intervalTimeout = DEFAULT_INTERVAL_TIMEOUT,
  onFailedAttempt,
  retries = DEFAULT_RETRY_COUNT,
}: RetryFetchMethodOptions = {}): FetchMethod {
  return async (url: string, init: RequestInit) => {
    const controller = new AbortController()

    return await retry<Response | undefined>(
      async () => {
        try {
          const response = await fetchMethod(url, init)

          if (!response) {
            controller.abort(
              new Error(
                `${apiName} API request failed with an unknown error. This request may not be retried.`,
              ),
            )

            return
          }

          if (response.status === RETRY_RESPONSE_STATUS) {
            throw new HttpError(
              `${apiName} API request failed with status: "[${response.status}] ${response.statusText}".`,
              RETRY_RESPONSE_STATUS,
            )
          }

          if (!response.ok) {
            controller.abort(
              new Error(
                `${apiName} API request failed with status: "[${response.status}] ${
                  response.statusText
                } - traceparent: ${response.headers.get(
                  'traceparent',
                )}". This request may not be retried`,
              ),
            )

            return
          }

          logger.debug(`${apiName} API response:`, response)

          return response
        } catch (error) {
          if (error instanceof HttpError && error.status === RETRY_RESPONSE_STATUS) {
            throw error
          }

          controller.abort(
            error instanceof Error
              ? error
              : new Error(
                  `${apiName} API request failed with an unknown error. This request may not be retried.`,
                ),
          )
        }
      },
      {
        minTimeout: intervalTimeout,
        onFailedAttempt: (options: FetchMethodCallbackOptions) =>
          onFailedAttempt?.({ ...options, apiName }),
        retries,
        signal: controller.signal,
      },
    )
  }
}
