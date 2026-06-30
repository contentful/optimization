import {
  BatchInsightsEventArray,
  parseWithFriendlyError,
} from '@contentful/optimization-api-schemas'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'
import { createScopedLogger } from '../logger'

const logger = createScopedLogger('ApiClient:Insights')
const BEACON_FALLBACK_MESSAGE = 'beacon failed; falling back to fetch'

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
export interface InsightsApiClientRequestOptions {
  /**
   * Sender used to enqueue serialized events via the Beacon API or a similar mechanism.
   *
   * @param url - Target URL for the batched events.
   * @param body - Serialized batched insights events to be sent.
   * @returns `true` if the events were successfully queued, `false` otherwise.
   *
   * @remarks
   * This option is intended for last-chance lifecycle delivery. If it returns
   * `false` or throws, the client falls back to emitting events immediately via
   * `fetch` with `keepalive`.
   */
  beacon?: (url: string, body: string) => boolean
}

/**
 * Configuration for {@link InsightsApiClient}.
 *
 * @public
 */
export interface InsightsApiClientConfig extends ApiConfig {}

/**
 * Client for sending analytics and insights events to the Ninetailed Insights API.
 *
 * @remarks
 * This client is optimized for sending batched events, optionally using a
 * custom beacon-like sender for last-chance lifecycle delivery.
 *
 * @example
 * ```ts
 * const insightsClient = new InsightsApiClient({
 *   clientId: 'org-id',
 *   environment: 'main',
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
 *
 * Extends `ApiClientBase`.
 *
 * @public
 */
export default class InsightsApiClient extends ApiClientBase {
  /**
   * Base URL used for Insights API requests.
   */
  protected readonly baseUrl: string

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
   * })
   * ```
   */
  constructor(config: InsightsApiClientConfig) {
    super('Insights', config)

    const { baseUrl } = config

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Set default for anything falsey
    this.baseUrl = baseUrl || INSIGHTS_BASE_URL
  }

  /**
   * Sends batches of insights events to the Ninetailed Insights API.
   *
   * @param batches - Array of event batches to send.
   * @param options - Optional request options, including a per-call `beacon` sender.
   * @returns `true` when the event batch is successfully queued by the beacon
   * sender or a direct request is successfully sent, `false` otherwise.
   *
   * @remarks
   * If a `beacon` sender is provided, it will be invoked first with the
   * serialized request body. When the sender returns `true`, the events are
   * considered successfully queued and no network request is made by this
   * method.
   *
   * If the sender is missing, returns `false`, or throws, the events are
   * emitted immediately via `fetch`.
   *
   * @example
   * ```ts
   * const success = await insightsClient.sendBatchEvents(batches)
   * ```
   *
   * @example
   * ```ts
   * // Use Beacon for a last-chance lifecycle flush
   * const success = await insightsClient.sendBatchEvents(batches, {
   *   beacon: (url, body) => navigator.sendBeacon(url, body),
   * })
   * ```
   */
  public async sendBatchEvents(
    batches: BatchInsightsEventArray,
    options: InsightsApiClientRequestOptions = {},
  ): Promise<boolean> {
    const { beacon } = options

    const url = new URL(
      `v1/organizations/${this.clientId}/environments/${this.environment}/events`,
      this.baseUrl,
    )
    const urlString = url.toString()

    const body = parseWithFriendlyError(BatchInsightsEventArray, batches)
    const serializedBody = JSON.stringify(body)

    if (beacon) {
      logger.debug('Queueing events via beacon')

      try {
        const beaconSuccessfullyQueued = beacon(urlString, serializedBody)

        if (beaconSuccessfullyQueued) {
          return true
        }

        logger.warn(BEACON_FALLBACK_MESSAGE)
      } catch (error) {
        logger.warn(BEACON_FALLBACK_MESSAGE, error)
      }
    }

    const requestName = 'Event Batches'

    logger.info(`Sending "${requestName}" request`)

    logger.debug(`"${requestName}" request body:`, body)

    try {
      await this.fetch(urlString, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: serializedBody,
        keepalive: !!beacon,
      })

      logger.debug(`"${requestName}" request successfully completed`)

      return true
    } catch (error) {
      this.logRequestError(error, { requestName })

      return false
    }
  }
}
