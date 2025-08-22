import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import InsightsApiClient, {
  INSIGHTS_BASE_URL,
  type InsightsApiClientConfig,
} from './InsightsApiClient'
import ApiClientBase from '../ApiClientBase'
import { logger } from '../../logger'
import { BatchEventArray, type BatchEventArrayType } from './dto/event'

const ORG_ID = 'org_123'
const ENV = 'prod'

const expectedUrl = new URL(
  `/v1/organizations/${ORG_ID}/environments/${ENV}/events`,
  INSIGHTS_BASE_URL,
)

function makeClient(overrides: Partial<InsightsApiClientConfig> = {}): InsightsApiClient {
  const config: InsightsApiClientConfig = {
    clientId: ORG_ID,
    environment: ENV,
    ...overrides,
  }
  return new InsightsApiClient(config)
}

// TODO: Find a better place for this sort of thing
function generateBatchEventArray(id: string): BatchEventArrayType {
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
            library: '',
            location: {},
            locale: '',
            page: {
              path: '/path',
              query: {},
              referrer: 'http://example.com',
              search: '',
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

const sendBeaconSpy = vi
  .fn<(url: string | URL, data?: Blob | null) => boolean>()
  .mockReturnValue(true)

describe('InsightsApiClient.sendBatchEvents', () => {
  beforeEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()

    // Add navigator to globalThis (avoid using DOM lib in a universal TS library)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { sendBeacon: sendBeaconSpy },
    })
  })

  afterEach(() => {
    // Remove navigator from globalThis (avoid using DOM lib in a universal TS library)
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    })

    vi.restoreAllMocks()
  })

  it('POSTs batches via fetch when beacon option is false', async () => {
    const batches = generateBatchEventArray('e1')

    // Spy on the schema parser and let it pass-through (or stub if needed)
    const parseSpy = vi
      .spyOn(BatchEventArray, 'parse')
      // @ts-expect-error -- testing
      .mockImplementation((input) => input)

    const infoSpy = vi.spyOn(logger, 'info')
    const debugSpy = vi.spyOn(logger, 'debug')

    const handler = http.post(
      `${INSIGHTS_BASE_URL}/v1/organizations/:orgId/environments/:env/events`,
      async ({ request, params }) => {
        expect(params.orgId).toBe(ORG_ID)
        expect(params.env).toBe(ENV)

        expect(request.headers.get('Content-Type')).toBe('application/json')
        const json = (await request.json()) as unknown
        expect(json).toEqual(batches)

        return HttpResponse.json({ ok: true }, { status: 200 })
      },
    )

    server.use(handler)

    const client = makeClient({ beacon: false })

    await expect(client.sendBatchEvents(batches)).resolves.toBeUndefined()

    expect(parseSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sending Send event batches request.'),
    )
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('request Body'), batches)
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('request succesfully completed.'))
  })

  it('uses navigator.sendBeacon when beacon by default', async () => {
    const batches = generateBatchEventArray('e2')

    // @ts-expect-error -- testing
    vi.spyOn(BatchEventArray, 'parse').mockImplementation((input) => input)

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const client = makeClient()

    await expect(client.sendBatchEvents(batches)).resolves.toBeUndefined()

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    expect(sendBeaconSpy).toHaveBeenCalledWith(expectedUrl, expect.any(Blob))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('logs and rethrows on network errors', async () => {
    const batches = generateBatchEventArray('e3')

    // @ts-expect-error -- testing
    vi.spyOn(BatchEventArray, 'parse').mockImplementation((input) => input)

    server.use(
      http.post(`${INSIGHTS_BASE_URL}/v1/organizations/:orgId/environments/:env/events`, () =>
        HttpResponse.error(),
      ),
    )

    // Spy on the inherited method from ApiClientBase prototype
    const logErrorSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing
      ApiClientBase.prototype as unknown as {
        logRequestError: (e: unknown, m: { requestName: string }) => void
      },
      'logRequestError',
    )

    const client = makeClient()

    await expect(client.sendBatchEvents(batches, { beacon: false })).rejects.toBeDefined()
    expect(logErrorSpy).toHaveBeenCalledTimes(1)
    expect(logErrorSpy).toHaveBeenCalledWith(expect.anything(), {
      requestName: 'Send event batches',
    })
  })
})
