import { logger } from '../../logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'
import { BatchEventArray } from './dto/event'

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

export default class InsightsApiClient extends ApiClientBase {
  protected readonly baseUrl: string
  protected readonly beacon: boolean

  constructor(config: InsightsApiClientConfig) {
    super('Insights', config)

    const { baseUrl, beacon } = config

    this.baseUrl = baseUrl ?? INSIGHTS_BASE_URL
    this.beacon = beacon ?? true
  }

  public async sendBatchEvents(
    batches: BatchEventArray,
    options: RequestOptions = {},
  ): Promise<void> {
    const { beacon = false } = options

    const url = new URL(
      `/v1/organizations/${this.clientId}/environments/${this.environment}/events`,
      this.baseUrl,
    )

    const body = BatchEventArray.parse(batches)

    if (beacon) {
      const blobData = new Blob([JSON.stringify(body)], {
        type: 'text/plain',
      })

      navigator.sendBeacon(url, blobData)

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
