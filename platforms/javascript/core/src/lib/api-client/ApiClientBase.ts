import { logger } from '../logger'
import Fetch, { type FetchMethod, type ProtectedFetchMethodOptions } from './fetch'

export interface ApiConfig {
  baseUrl?: string
  optimizationEnv?: string
  fetchOptions?: Omit<ProtectedFetchMethodOptions, 'apiName'>
  optimizationKey: string
  preview?: boolean
}

export type GlobalApiConfigProperties =
  | 'optimizationEnv'
  | 'fetchOptions'
  | 'optimizationKey'
  | 'preview'

const DEFAULT_ENVIRONMENT = 'main'

abstract class ApiClientBase {
  protected readonly name: string
  protected readonly optimizationKey: string
  protected readonly optimizationEnv: string
  protected readonly preview?: boolean

  protected readonly fetch: FetchMethod

  constructor(
    name: string,
    { fetchOptions, optimizationKey, optimizationEnv: environment, preview }: ApiConfig,
  ) {
    this.optimizationKey = optimizationKey
    this.optimizationEnv = environment ?? DEFAULT_ENVIRONMENT
    this.name = name
    this.preview = Boolean(preview)

    this.fetch = Fetch.create({ ...(fetchOptions ?? {}), apiName: name })
  }

  protected logRequestError(error: unknown, { requestName }: { requestName: string }): void {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.warn(
          `${this.name} API ${requestName} request aborted due to network issues. This request may not be retried.`,
        )
      } else {
        logger.error(
          `${this.name} API ${requestName} request failed with error: [${error.name}] ${error.message}`,
        )
      }
    }
  }
}

export default ApiClientBase
