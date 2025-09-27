import { logger } from '../../logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'
import { BatchInsightsEventArray } from './dto/event'

interface RequestOptions {
  /**
   * `beaconHandler` allows the usage of the Beacon API, or any similar request handler, instead of direct posting of data via `fetch` in the SDK.
   */
  beaconHandler?: (url: string | URL, data: BatchInsightsEventArray) => boolean
}

export interface InsightsApiClientConfig extends ApiConfig, RequestOptions {}

export const INSIGHTS_BASE_URL = 'https://ingest.insights.ninetailed.co/'

export default class InsightsApiClient extends ApiClientBase {
  protected readonly baseUrl: string
  private readonly beaconHandler: RequestOptions['beaconHandler']

  constructor(config: InsightsApiClientConfig) {
    super('Insights', config)

    const { baseUrl, beaconHandler } = config

    this.baseUrl = baseUrl ?? INSIGHTS_BASE_URL
    this.beaconHandler = beaconHandler
  }

  public async sendBatchEvents(
    batches: BatchInsightsEventArray,
    options: RequestOptions = {},
  ): Promise<void> {
    const { beaconHandler = this.beaconHandler } = options

    const url = new URL(
      `v1/organizations/${this.optimizationKey}/environments/${this.optimizationEnv}/events`,
      this.baseUrl,
    )

    const body = BatchInsightsEventArray.parse(batches)

    if (typeof beaconHandler === 'function') {
      logger.info('Queueing events via beaconHandler')

      const beaconSuccessfullyQueued = beaconHandler(url, body)

      if (beaconSuccessfullyQueued) {
        return
      } else {
        logger.warn(
          'beaconHandler failed to queue events; events will be emitted immediately via fetch',
        )
      }
    }

    const requestName = 'Event Batches'

    logger.info(`Sending ${this.name} API "${requestName}" request.`)

    logger.debug(`${this.name} API "${requestName}" request Body: `, body)

    try {
      await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      logger.debug(`${this.name} API "${requestName}" request succesfully completed.`)
    } catch (error) {
      this.logRequestError(error, { requestName })

      throw error
    }
  }
}
