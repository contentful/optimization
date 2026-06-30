import { BatchInsightsEventArray } from '@contentful/optimization-api-schemas'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import { mockLogger } from 'mocks'
import { http, HttpResponse } from 'msw'
import ApiClientBase from '../ApiClientBase'
import type { FetchMethod } from '../fetch'
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
function generateBatchEventArray(
  id: string,
  eventType: 'component' | 'component_click' | 'component_hover' = 'component',
): BatchInsightsEventArray {
  const baseEvent = {
    componentType: 'Entry' as const,
    componentId: crypto.randomUUID(),
    variantIndex: 0,
    channel: 'web' as const,
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
  }

  const event =
    eventType === 'component'
      ? {
          ...baseEvent,
          type: 'component' as const,
          viewId: crypto.randomUUID(),
          viewDurationMs: 1000,
        }
      : eventType === 'component_hover'
        ? {
            ...baseEvent,
            type: 'component_hover' as const,
            hoverId: crypto.randomUUID(),
            hoverDurationMs: 1000,
          }
        : {
            ...baseEvent,
            type: 'component_click' as const,
          }

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
      events: [event],
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

    const parseSpy = rs.spyOn(BatchInsightsEventArray, 'safeParse').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing: bypassing schema validation
      ((input: unknown) => ({
        success: true,
        data: input,
      })) as typeof BatchInsightsEventArray.safeParse,
    )

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

  it('uses beacon sender when supplied', async () => {
    const batches = generateBatchEventArray('e2')

    rs.spyOn(BatchInsightsEventArray, 'safeParse').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing: bypassing schema validation
      ((input: unknown) => ({
        success: true,
        data: input,
      })) as typeof BatchInsightsEventArray.safeParse,
    )

    const beacon = rs.fn<(url: string, body: string) => boolean>(() => true)

    const fetchSpy = rs.spyOn(globalThis, 'fetch')

    const client = makeClient()

    await expect(client.sendBatchEvents(batches, { beacon })).resolves.toBe(true)

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith(expectedUrl.toString(), expect.any(String))
    expect(JSON.parse(beacon.mock.calls[0]?.[1] ?? '')).toEqual(batches)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not use keepalive for default fetch delivery', async () => {
    const batches = generateBatchEventArray('e2-default-fetch')
    const fetchMethod = rs.fn<FetchMethod>(async () => {
      await Promise.resolve()
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    const client = makeClient({ fetchOptions: { fetchMethod } })

    await expect(client.sendBatchEvents(batches)).resolves.toBe(true)

    expect(fetchMethod).toHaveBeenCalledWith(
      expectedUrl.toString(),
      expect.objectContaining({ keepalive: false }),
    )
  })

  it('accepts and POSTs component_click events', async () => {
    const batches = generateBatchEventArray('e2-click', 'component_click')

    const handler = http.post(
      `${INSIGHTS_BASE_URL}v1/organizations/:orgId/environments/:env/events`,
      async ({ request }) => {
        const json = (await request.json()) as unknown
        expect(json).toEqual(batches)
        return HttpResponse.json({ ok: true }, { status: 200 })
      },
    )

    server.use(handler)

    const client = makeClient()

    await expect(client.sendBatchEvents(batches)).resolves.toBe(true)
  })

  it('accepts and POSTs component_hover events', async () => {
    const batches = generateBatchEventArray('e2-hover', 'component_hover')

    const handler = http.post(
      `${INSIGHTS_BASE_URL}v1/organizations/:orgId/environments/:env/events`,
      async ({ request }) => {
        const json = (await request.json()) as unknown
        expect(json).toEqual(batches)
        return HttpResponse.json({ ok: true }, { status: 200 })
      },
    )

    server.use(handler)

    const client = makeClient()

    await expect(client.sendBatchEvents(batches)).resolves.toBe(true)
  })

  it('POSTs batches via keepalive fetch when beacon sender fails', async () => {
    const batches = generateBatchEventArray('e3')

    const beacon = rs.fn<(url: string, body: string) => boolean>(() => false)
    const fetchMethod = rs.fn<FetchMethod>(async () => {
      await Promise.resolve()
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    const client = makeClient({ fetchOptions: { fetchMethod } })

    await expect(client.sendBatchEvents(batches, { beacon })).resolves.toBe(true)

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith(expectedUrl.toString(), expect.any(String))
    expect(JSON.parse(beacon.mock.calls[0]?.[1] ?? '')).toEqual(batches)
    expect(fetchMethod).toHaveBeenCalledWith(
      expectedUrl.toString(),
      expect.objectContaining({ keepalive: true }),
    )
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

  it('POSTs batches via keepalive fetch when beacon sender throws', async () => {
    const batches = generateBatchEventArray('e3-throw')
    const beacon = rs.fn<(url: string, body: string) => boolean>(() => {
      throw new Error('beacon-down')
    })
    const fetchMethod = rs.fn<FetchMethod>(async () => {
      await Promise.resolve()
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    const client = makeClient({ fetchOptions: { fetchMethod } })

    await expect(client.sendBatchEvents(batches, { beacon })).resolves.toBe(true)

    expect(fetchMethod).toHaveBeenCalledWith(
      expectedUrl.toString(),
      expect.objectContaining({ keepalive: true }),
    )
  })

  it('logs and returns false on network errors', async () => {
    const batches = generateBatchEventArray('e4')

    rs.spyOn(BatchInsightsEventArray, 'safeParse').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing: bypassing schema validation
      ((input: unknown) => ({
        success: true,
        data: input,
      })) as typeof BatchInsightsEventArray.safeParse,
    )

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
