import { logger } from '../logger'
import Fetch, { type FetchMethod, type ProtectedFetchMethodOptions } from './fetch'

export interface ApiConfig {
  baseUrl?: string
  clientId: string
  environment?: string
  fetchOptions?: Omit<ProtectedFetchMethodOptions, 'apiName'>
  preview?: boolean
}

const DEFAULT_ENVIRONMENT = 'main'

abstract class ApiClientBase {
  protected abstract readonly baseUrl: string
  protected readonly name: string
  protected readonly clientId: string
  protected readonly environment: string
  protected readonly preview?: boolean

  protected readonly fetch: FetchMethod

  constructor(name: string, { fetchOptions, clientId, environment, preview }: ApiConfig) {
    this.clientId = clientId
    this.environment = environment ?? DEFAULT_ENVIRONMENT
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
