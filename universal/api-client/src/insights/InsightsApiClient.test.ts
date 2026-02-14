import { BatchInsightsEventArray } from '@contentful/optimization-api-schemas'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { mockLogger } from 'mocks'
import { http, HttpResponse } from 'msw'
import ApiClientBase from '../ApiClientBase'
import { server } from '../test/setup'
import InsightsApiClient, {
  INSIGHTS_BASE_URL,
  type InsightsApiClientConfig,
} from './InsightsApiClient'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const expectedUrl = new URL(
  `/v1/organizations/${CLIENT_ID}/environments/${ENVIRONMENT}/events`,
  INSIGHTS_BASE_URL,
)

function makeClient(overrides: Partial<InsightsApiClientConfig> = {}): InsightsApiClient {
  const config: InsightsApiClientConfig = {
    clientId: CLIENT_ID,
    environment: ENVIRONMENT,
    ...overrides,
  }
  return new InsightsApiClient(config)
}

// TODO: Find a better place for this sort of thing
function generateBatchEventArray(id: string): BatchInsightsEventArray {
  return [
    {
      profile: {
        id,
        stableId: id,
        random: Math.random(),
        audiences: ['audience1'],
        traits: { trait: 'trait' },
        location: {},
        session: {
          id: 's2',
          isReturningVisitor: false,
          landingPage: {
            path: '/path',
            query: {},
            referrer: 'http://example.com',
            search: '',
            title: 'Document Title',
            url: 'http://example.com/path',
          },
          count: 0,
          averageSessionLength: 1,
          activeSessionLength: 1,
        },
      },
      events: [
        {
          type: 'component',
          componentType: 'Entry',
          componentId: crypto.randomUUID(),
          variantIndex: 0,
          channel: 'web',
          context: {
            campaign: {},
            gdpr: { isConsentGiven: true },
            library: {
              name: 'Library',
              version: '0',
            },
            location: {},
            locale: '',
            page: {
              path: '/path',
              query: {},
              referrer: 'http://example.com',
              search: '',
              title: 'Document Title',
              url: 'http://example.com/path',
            },
          },
          messageId: crypto.randomUUID(),
          originalTimestamp: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        },
      ],
    },
  ]
}

describe('InsightsApiClient.sendBatchEvents', () => {
  beforeEach(() => {
    server.resetHandlers()
    rs.clearAllMocks()
  })

  afterEach(() => {
    // Remove navigator from globalThis (avoid using DOM lib in a universal TS library)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    })

    rs.restoreAllMocks()
  })

  it('POSTs batches via fetch by default', async () => {
    const batches = generateBatchEventArray('e1')

    // Spy on the schema parser and let it pass-through (or stub if needed)
    const parseSpy = rs
      .spyOn(BatchInsightsEventArray, 'parse')
      // @ts-expect-error -- testing
      .mockImplementation((input) => input)

    const handler = http.post(
      `${INSIGHTS_BASE_URL}v1/organizations/:orgId/environments/:env/events`,
      async ({ request, params }) => {
        expect(params.orgId).toBe(CLIENT_ID)
        expect(params.env).toBe(ENVIRONMENT)

        expect(request.headers.get('Content-Type')).toBe('application/json')
        const json = (await request.json()) as unknown
        expect(json).toEqual(batches)

        return HttpResponse.json({ ok: true }, { status: 200 })
      },
    )

    server.use(handler)

    const client = makeClient()

    await expect(client.sendBatchEvents(batches)).resolves.toBe(true)

    expect(parseSpy).toHaveBeenCalledTimes(1)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ApiClient:Insights',
      'Sending "Event Batches" request',
    )
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Insights',
      expect.stringContaining('request body'),
      batches,
    )
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Insights',
      expect.stringContaining('request successfully completed'),
    )
  })

  it('uses beaconHandler when supplied', async () => {
    const batches = generateBatchEventArray('e2')

    // @ts-expect-error -- testing
    rs.spyOn(BatchInsightsEventArray, 'parse').mockImplementation((input) => input)

    const beaconHandler = rs.fn(() => true)

    const fetchSpy = rs.spyOn(globalThis, 'fetch')

    const client = makeClient()

    await expect(client.sendBatchEvents(batches, { beaconHandler })).resolves.toBe(true)

    expect(beaconHandler).toHaveBeenCalledTimes(1)
    expect(beaconHandler).toHaveBeenCalledWith(expectedUrl, batches)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs batches via fetch when beaconHandler fails', async () => {
    const batches = generateBatchEventArray('e3')

    const beaconHandler = rs.fn(() => false)

    const handler = http.post(
      `${INSIGHTS_BASE_URL}v1/organizations/:orgId/environments/:env/events`,
      () => HttpResponse.json({ ok: true }, { status: 200 }),
    )

    server.use(handler)

    const client = makeClient()

    await expect(client.sendBatchEvents(batches, { beaconHandler })).resolves.toBe(true)

    expect(beaconHandler).toHaveBeenCalledTimes(1)
    expect(beaconHandler).toHaveBeenCalledWith(expectedUrl, batches)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ApiClient:Insights',
      'Sending "Event Batches" request',
    )
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Insights',
      expect.stringContaining('request body'),
      batches,
    )
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Insights',
      expect.stringContaining('request successfully completed'),
    )
  })

  it('logs and returns false on network errors', async () => {
    const batches = generateBatchEventArray('e4')

    // @ts-expect-error -- testing
    rs.spyOn(BatchInsightsEventArray, 'parse').mockImplementation((input) => input)

    server.use(
      http.post(`${INSIGHTS_BASE_URL}v1/organizations/:orgId/environments/:env/events`, () =>
        HttpResponse.error(),
      ),
    )

    // Spy on the inherited method from ApiClientBase prototype
    const logErrorSpy = rs.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing
      ApiClientBase.prototype as unknown as {
        logRequestError: (e: unknown, m: { requestName: string }) => void
      },
      'logRequestError',
    )

    const client = makeClient()

    await expect(client.sendBatchEvents(batches)).resolves.toBe(false)
    expect(logErrorSpy).toHaveBeenCalledTimes(1)
    expect(logErrorSpy).toHaveBeenCalledWith(expect.anything(), {
      requestName: 'Event Batches',
    })
  })
})
