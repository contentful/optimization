import { logger } from 'logger'
import { createRetryFetchMethod, type RetryFetchMethodOptions } from './createRetryFetchMethod'
import {
  createTimeoutFetchMethod,
  type TimeoutFetchMethodOptions,
} from './createTimeoutFetchMethod'
import type { FetchMethod } from './Fetch'

export interface ProtectedFetchMethodOptions
  extends RetryFetchMethodOptions,
    TimeoutFetchMethodOptions {
  requestName?: string
}

export function createProtectedFetchMethod(options: ProtectedFetchMethodOptions): FetchMethod {
  try {
    const timeoutFetchMethod = createTimeoutFetchMethod(options)
    const retryFetchMethod = createRetryFetchMethod({ ...options, fetchMethod: timeoutFetchMethod })

    return retryFetchMethod
  } catch (error) {
    const { requestName } = options

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.warn(
          `${requestName} request aborted due to network issues. This request may not be retried.`,
        )
      } else {
        logger.error(`${requestName} request failed with error: [${error.name}] ${error.message}`)
      }
    }
    throw error
  }
}
