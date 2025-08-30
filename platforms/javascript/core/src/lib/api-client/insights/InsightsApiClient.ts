import { logger } from '../../logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'
import { BatchEventArray, type BatchEventArrayType } from './dto/event'

// TODO: consider injecting/passing beacon instead of detecting from globalThis
interface RequestOptions {
  /**
   * Insights analytics events may be queued using the Beacon API
   *
   * @default true
   */
  beacon?: boolean
}

export interface InsightsApiClientConfig extends ApiConfig, RequestOptions {}

export const INSIGHTS_BASE_URL = 'https://ingest.insights.ninetailed.co'

interface NavigatorLike {
  sendBeacon: (url: URL, data?: Blob) => boolean
}

function hasNavigator(o: unknown): o is { navigator: unknown } {
  return typeof o === 'object' && o !== null && 'navigator' in o
}

function isNavigatorLike(x: unknown): x is NavigatorLike {
  return typeof x === 'object' && x !== null
}

function getNavigator(): NavigatorLike | undefined {
  const g: unknown = globalThis

  if (hasNavigator(g)) {
    const { navigator } = g
    return isNavigatorLike(navigator) ? navigator : undefined
  }

  return undefined
}

export default class InsightsApiClient extends ApiClientBase {
  protected readonly baseUrl: string
  private readonly beacon: boolean

  constructor(config: InsightsApiClientConfig) {
    super('Insights', config)

    const { baseUrl, beacon } = config

    this.baseUrl = baseUrl ?? INSIGHTS_BASE_URL
    this.beacon = beacon ?? true
  }

  public async sendBatchEvents(
    batches: BatchEventArrayType,
    options: RequestOptions = {},
  ): Promise<void> {
    const { beacon = this.beacon } = options

    const url = new URL(
      `/v1/organizations/${this.clientId}/environments/${this.environment}/events`,
      this.baseUrl,
    )

    const body = BatchEventArray.parse(batches)

    if (beacon && hasNavigator(globalThis)) {
      const blobData = new Blob([JSON.stringify(body)], {
        type: 'text/plain',
      })

      getNavigator()?.sendBeacon(url, blobData)

      return
    }

    const requestName = 'Send event batches'

    logger.info(`Sending ${requestName} request.`)

    logger.debug(`${requestName} request Body: `, body)

    try {
      await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      logger.debug(`${requestName} request succesfully completed.`)
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }
}
