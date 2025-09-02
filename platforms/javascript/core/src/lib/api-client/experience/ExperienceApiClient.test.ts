import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ExperienceApiClient, {
  EXPERIENCE_BASE_URL,
  type ExperienceApiClientConfig,
} from './ExperienceApiClient'
import { logger } from '../../logger'
import { ExperienceResponse, BatchExperienceResponse } from './dto'
import { EventArray } from './dto/event'
import { server } from '../../../test/setup'

const ORG_ID = 'org_123'
const ENV = 'prod'

const getLocaleParam = (url: string): string | null => new URL(url).searchParams.get('locale')
const getTypeParam = (url: string): string | null => new URL(url).searchParams.get('type')
const getPathname = (url: string): string => new URL(url).pathname
const getContentType = (headers: Headers): string | null => headers.get('Content-Type')
const getHeader = (headers: Headers, name: string): string | null => headers.get(name)
const getFeaturesFromBody = (body: unknown): string[] | undefined => {
  if (typeof body !== 'object' || body === null) return undefined
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing
  const { options } = body as Record<string, unknown>

  if (!options || typeof options !== 'object') return undefined
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing
  const { features } = options as Record<string, unknown>

  if (!Array.isArray(features)) return undefined

  return features.every((f) => typeof f === 'string') ? features : undefined
}

function hasOptionsKey(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'options' in body
}

function makeClient(overrides: Partial<ExperienceApiClientConfig> = {}): ExperienceApiClient {
  const config: ExperienceApiClientConfig = {
    clientId: ORG_ID,
    environment: ENV,
    ...overrides,
  }
  return new ExperienceApiClient(config)
}

describe('ExperienceApiClient', () => {
  beforeEach(() => {
    server.resetHandlers()
    vi.spyOn(logger, 'info')
    vi.spyOn(logger, 'debug')
    vi.spyOn(logger, 'warn')
    vi.spyOn(logger, 'error')

    vi.spyOn(ExperienceResponse, 'parse')
      // @ts-expect-error -- testing
      .mockImplementation((json) => json)

    vi.spyOn(BatchExperienceResponse, 'parse')
      // @ts-expect-error -- testing
      .mockImplementation((json) => json)

    vi.spyOn(EventArray, 'parse')
      // @ts-expect-error -- testing
      .mockImplementation((json) => json)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProfile', () => {
    it('throws on empty profile id', async () => {
      const client = makeClient()
      await expect(client.getProfile('')).rejects.toThrowError('Valid profile ID required.')
    })

    it('getProfile hits the correct URL with default environment and optional locale', async () => {
      const requested: { org?: string; env?: string; id?: string; locale?: string | null } = {}

      server.use(
        http.get(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles/:id`,
          ({ request, params }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- testing
            const { org, env, id } = params as Record<string, string>
            requested.org = org
            requested.env = env
            requested.id = id
            requested.locale = getLocaleParam(request.url)

            return HttpResponse.json({ data: { id } }, { status: 200 })
          },
        ),
      )

      const client = makeClient()

      // without locale
      const profile = await client.getProfile('prof_1')
      expect(profile).toBeDefined()
      expect(requested.org).toBe(ORG_ID)
      expect(requested.env).toBe(ENV)
      expect(requested.id).toBe('prof_1')
      expect(requested.locale).toBeNull()

      // with locale
      const profile2 = await client.getProfile('prof_2', { locale: 'de-DE' })
      expect(profile2).toBeDefined()
      expect(requested.id).toBe('prof_2')
      expect(requested.locale).toBe('de-DE')

      expect(logger.info).toHaveBeenCalledWith('Sending Get Profile request.')
      expect(logger.debug).toHaveBeenCalledWith('Get Profile request succesfully completed.')
    })

    it('logs an error when the request fails (network error)', async () => {
      server.use(
        http.get(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles/:id`,
          () => HttpResponse.error(),
        ),
      )

      const client = makeClient()
      await expect(client.getProfile('x')).rejects.toBeDefined()

      // The base client logs errors via logger.error on non-abort errors
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('createProfile', () => {
    it('createProfile sends text/plain by default and includes enabledFeatures in body when provided', async () => {
      let capturedContentType: string | null = null
      let capturedFeatures: string[] | undefined

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles`,
          async ({ request }) => {
            capturedContentType = getContentType(request.headers)
            const body = await request.json()
            capturedFeatures = getFeaturesFromBody(body)

            return HttpResponse.json({ data: { id: 'new_profile' } }, { status: 200 })
          },
        ),
      )

      const client = makeClient()

      const result = await client.createProfile({ events: [] }, { enabledFeatures: ['location'] })
      expect(result).toBeDefined()

      // Defaults to plaintext (no CORS preflight)
      expect(capturedContentType).toBe('text/plain')

      // features only present when provided
      expect(capturedFeatures).toEqual(['location'])

      expect(logger.info).toHaveBeenCalledWith('Sending Create Profile request.')
      expect(logger.debug).toHaveBeenCalledWith('Create Profile request body: ', {
        events: [],
        options: { features: ['location'] },
      })
      expect(logger.debug).toHaveBeenCalledWith('Create Profile request succesfully completed.')
    })

    it('createProfile respects per-request overrides: plainText=false, ip header, preflight query', async () => {
      let contentType: string | null = null
      let forcedIp: string | null = null
      let typeQuery: string | null = null

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles`,
          ({ request }) => {
            contentType = getContentType(request.headers)
            forcedIp = getHeader(request.headers, 'X-Force-IP')
            typeQuery = getTypeParam(request.url)
            return HttpResponse.json({ data: { id: 'new_profile' } }, { status: 200 })
          },
        ),
      )

      const client = makeClient()

      await client.createProfile(
        { events: [] },
        { plainText: false, ip: '203.0.113.10', preflight: true },
      )

      expect(contentType).toBe('application/json')
      expect(forcedIp).toBe('203.0.113.10')
      expect(typeQuery).toBe('preflight')
    })

    it('omits options.features when not provided (no empty arrays)', async () => {
      let rawBody: unknown

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles`,
          async ({ request }) => {
            rawBody = await request.json()
            return HttpResponse.json({ data: { id: 'new_profile' } }, { status: 200 })
          },
        ),
      )

      const client = makeClient()

      await client.createProfile({ events: [] }, {})

      expect(hasOptionsKey(rawBody)).toBe(true)
      expect(getFeaturesFromBody(rawBody)).toBeUndefined()
    })
  })

  describe('updateProfile', () => {
    it('throws on empty profile id', async () => {
      const client = makeClient()
      await expect(client.updateProfile({ profileId: '', events: [] })).rejects.toThrowError(
        'Valid profile ID required.',
      )
    })

    it('updateProfile posts to the correct URL with provided profileId', async () => {
      let hitPath: string | null = null

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles/:profileId`,
          ({ request, params }) => {
            const { profileId } = params
            hitPath = getPathname(request.url)
            return HttpResponse.json({ data: { id: profileId } }, { status: 200 })
          },
        ),
      )

      const client = makeClient({ environment: 'prod' })

      const result = await client.updateProfile({ profileId: 'prof_42', events: [] }, {})

      expect(result).toBeDefined()
      expect(hitPath).toBe(`/v2/organizations/${ORG_ID}/environments/${ENV}/profiles/prof_42`)
    })

    it('client-level defaults (enabledFeatures, ip, plainText) apply when not overridden', async () => {
      let contentType: string | null = null
      let forcedIp: string | null = null
      let features: string[] | undefined

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/profiles/:profileId`,
          async ({ request }) => {
            contentType = getContentType(request.headers)
            forcedIp = getHeader(request.headers, 'X-Force-IP')
            const body = await request.json()
            features = getFeaturesFromBody(body)
            return HttpResponse.json({ data: { id: 'p' } }, { status: 200 })
          },
        ),
      )

      const client = makeClient({
        enabledFeatures: ['location'],
        ip: '198.51.100.5',
        plainText: false,
      })

      const res = await client.updateProfile({ profileId: 'p', events: [] }, {})
      expect(res).toBeDefined()

      // Inherited from client config
      expect(contentType).toBe('application/json')
      expect(forcedIp).toBe('198.51.100.5')
      expect(features).toEqual(['location'])
    })
  })

  describe('upsertManyProfiles', () => {
    it('upsertManyProfiles posts to /events and defaults to application/json (plainText=false)', async () => {
      let contentType: string | null = null

      server.use(
        http.post(
          `${EXPERIENCE_BASE_URL}/v2/organizations/:org/environments/:env/events`,
          ({ request }) => {
            contentType = getContentType(request.headers)
            return HttpResponse.json(
              { data: { profiles: [{ id: 'a' }, { id: 'b' }] } },
              { status: 200 },
            )
          },
        ),
      )

      const client = makeClient()

      const profiles = await client.upsertManyProfiles({ events: [] }, {})
      expect(Array.isArray(profiles)).toBe(true)
      expect(contentType).toBe('application/json')
    })
  })
})
