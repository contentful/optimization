import { BatchInsightsEventArray } from '@contentful/optimization-api-schemas'
import { logger } from 'logger'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'

const LOG_LOCATION = 'ApiClient:Insights'

/**
 * Default base URL for the Insights ingest API.
 *
 * @public
 */
export const INSIGHTS_BASE_URL = 'https://ingest.insights.ninetailed.co/'

/**
 * Options that control how Insights events are sent.
 *
 * @public
 */
interface RequestOptions {
  /**
   * Handler used to enqueue events via the Beacon API or a similar mechanism.
   *
   * @param url - Target URL for the batched events.
   * @param data - Array of batched insights events to be sent.
   * @returns `true` if the events were successfully queued, `false` otherwise.
   *
   * @remarks
   * When provided, this handler is preferred over direct `fetch` calls. If it
   * returns `false`, the client falls back to emitting events immediately via
   * `fetch`.
   */
  beaconHandler?: (url: string | URL, data: BatchInsightsEventArray) => boolean
}

/**
 * Configuration for {@link InsightsApiClient}.
 *
 * @public
 */
export interface InsightsApiClientConfig extends ApiConfig, RequestOptions {}

/**
 * Client for sending analytics and insights events to the Ninetailed Insights API.
 *
 * @public
 *
 * @remarks
 * This client is optimized for sending batched events, optionally using a
 * custom beacon-like handler when available.
 *
 * @example
 * ```ts
 * const insightsClient = new InsightsApiClient({
 *   clientId: 'org-id',
 *   environment: 'main',
 *   preview: false,
 * })
 *
 * await insightsClient.sendBatchEvents([
 *   {
 *     profile: { id: 'profile-123', ... },
 *     events: [
 *       {
 *         type: 'track',
 *         event: 'button_clicked',
 *         properties: { id: 'primary-cta' },
 *       },
 *     ],
 *   }
 * ])
 * ```
 */
export default class InsightsApiClient extends ApiClientBase {
  /**
   * Base URL used for Insights API requests.
   */
  protected readonly baseUrl: string

  /**
   * Optional handler used to enqueue events via the Beacon API or a similar mechanism.
   */
  private readonly beaconHandler: RequestOptions['beaconHandler']

  /**
   * Creates a new {@link InsightsApiClient} instance.
   *
   * @param config - Configuration for the Insights API client.
   *
   * @example
   * ```ts
   * const client = new InsightsApiClient({
   *   clientId: 'org-id',
   *   environment: 'main',
   *   beaconHandler: (url, data) => {
   *     return navigator.sendBeacon(url.toString(), JSON.stringify(data))
   *   },
   * })
   * ```
   */
  constructor(config: InsightsApiClientConfig) {
    super('Insights', config)

    const { baseUrl, beaconHandler } = config

    this.baseUrl = baseUrl ?? INSIGHTS_BASE_URL
    this.beaconHandler = beaconHandler
  }

  /**
   * Sends batches of insights events to the Ninetailed Insights API.
   *
   * @param batches - Array of event batches to send.
   * @param options - Optional request options, including a per-call `beaconHandler`.
   * @returns A promise that resolves when the events have been sent or queued.
   *
   * @remarks
   * If a `beaconHandler` is provided (either in the method call or in the
   * client configuration) it will be invoked first. When the handler returns
   * `true`, the events are considered successfully queued and no network
   * request is made by this method.
   *
   * If the handler is missing or returns `false`, the events are emitted
   * immediately via `fetch`.
   *
   * @returns A boolean value that is true when either the event batch is successfully
   * queued by the beacon handler or a direct request is successfully sent.
   *
   * @example
   * ```ts
   * const success = await insightsClient.sendBatchEvents(batches)
   * ```
   *
   * @example
   * ```ts
   * // Override beaconHandler for a single call
   * const success = await insightsClient.sendBatchEvents(batches, {
   *   beaconHandler: (url, data) => {
   *     return navigator.sendBeacon(url.toString(), JSON.stringify(data))
   *   },
   * })
   * ```
   */
  public async sendBatchEvents(
    batches: BatchInsightsEventArray,
    options: RequestOptions = {},
  ): Promise<boolean> {
    const { beaconHandler = this.beaconHandler } = options

    const url = new URL(
      `v1/organizations/${this.clientId}/environments/${this.environment}/events`,
      this.baseUrl,
    )

    const body = BatchInsightsEventArray.parse(batches)

    if (typeof beaconHandler === 'function') {
      logger.debug(LOG_LOCATION, 'Queueing events via beaconHandler')

      const beaconSuccessfullyQueued = beaconHandler(url, body)

      if (beaconSuccessfullyQueued) {
        return true
      } else {
        logger.warn(
          LOG_LOCATION,
          'beaconHandler failed to queue events; events will be emitted immediately via fetch',
        )
      }
    }

    const requestName = 'Event Batches'

    logger.info(LOG_LOCATION, `Sending "${requestName}" request`)

    logger.debug(LOG_LOCATION, `"${requestName}" request body:`, body)

    try {
      await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        keepalive: true,
      })

      logger.debug(LOG_LOCATION, `"${requestName}" request successfully completed`)

      return true
    } catch (error) {
      this.logRequestError(error, { requestName })

      return false
    }
  }
}
