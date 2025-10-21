import { logger } from 'logger'
import type { BaseFetchMethodOptions, FetchMethod, FetchMethodCallbackOptions } from './Fetch'

export interface TimeoutFetchMethodOptions extends BaseFetchMethodOptions {
  onRequestTimeout?: (options: FetchMethodCallbackOptions) => void
  requestTimeout?: number
}

const DEFAULT_REQUEST_TIMEOUT = 3000

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
