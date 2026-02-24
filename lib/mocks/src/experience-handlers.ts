import {
  BatchExperienceEventArray,
  ExperienceEventArray,
  ExperienceResponse,
  type ExperienceRequestData,
} from '@contentful/optimization-api-schemas'
import { cloneDeep } from 'es-toolkit/compat'
import { http, HttpResponse, type HttpHandler } from 'msw'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const _filename = fileURLToPath(import.meta.url)
const _dirname = dirname(_filename)
const BASE_DIR = resolve(_dirname, './experience/data')
const newVisitorPath = join(BASE_DIR, `new-visitor.json`)
const identifiedVisitorPath = join(BASE_DIR, `identified-visitor.json`)
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

type State = Record<string, boolean>

let identifiedState: State = {}

let newVisitor: ExperienceResponse | undefined = undefined
let identifiedVisitor: ExperienceResponse | undefined = undefined
let fixtureLoadPromise: Promise<void> | undefined = undefined
let fixtureLoadError: unknown = undefined

async function loadFixtures(): Promise<void> {
  const [newVisitorData, identifiedVisitorData] = await Promise.all([
    readFile(newVisitorPath, 'utf8'),
    readFile(identifiedVisitorPath, 'utf8'),
  ])

  newVisitor = ExperienceResponse.parse(JSON.parse(newVisitorData))
  identifiedVisitor = ExperienceResponse.parse(JSON.parse(identifiedVisitorData))
}

async function ensureFixturesLoaded(): Promise<void> {
  fixtureLoadPromise ??= loadFixtures().catch((error: unknown) => {
    fixtureLoadError = error
    throw error
  })

  await fixtureLoadPromise
}

function fixturesUnavailableResponse(): Response {
  const message =
    fixtureLoadError instanceof Error
      ? fixtureLoadError.message
      : 'Experience fixtures are not available'

  return HttpResponse.json(
    { error: 'Fixtures unavailable', message },
    { headers: CORS_HEADERS, status: 503 },
  )
}

function getLoadedFixtures(): {
  identifiedVisitor: ExperienceResponse
  newVisitor: ExperienceResponse
} {
  if (!newVisitor || !identifiedVisitor) throw new Error('Experience fixtures not loaded')

  return { identifiedVisitor, newVisitor }
}

// Helper to parse JSON whether body is application/json or text/plain
async function parseJson<T>(req: Request): Promise<T> {
  const content = req.headers.get('content-type') ?? ''
  if (content.includes('application/json')) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
    return (await req.json()) as T
  }

  // text/plain or others -> try text then JSON.parse
  const raw = await req.text()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
  return JSON.parse(raw) as T
}

function hasIdentifyEvent(events: ExperienceEventArray | undefined): boolean {
  if (!events?.length) return false

  return events.some(({ type }) => type === 'identify')
}

function getResponseBody(profileId?: string, events?: ExperienceEventArray): ExperienceResponse {
  const fixtures = getLoadedFixtures()

  profileId ??= crypto.randomUUID()

  const identified = identifiedState[profileId] ?? false

  let responseBody: ExperienceResponse = cloneDeep(fixtures.newVisitor)

  if (identified || hasIdentifyEvent(events)) {
    identifiedState[profileId] = true
    responseBody = cloneDeep(fixtures.identifiedVisitor)
  }

  responseBody.data.profile.id = profileId
  responseBody.data.profile.stableId = profileId

  return responseBody
}

/**
 * Returns MSW request handlers that mock the Experience API v2 endpoints.
 *
 * @param baseUrl - URL prefix prepended to each route pattern.
 * @returns An array of {@link HttpHandler} instances for use with MSW.
 *
 * @example
 * ```typescript
 * import { setupServer } from 'msw/node'
 * import { getHandlers } from './experience-handlers'
 *
 * const server = setupServer(...getHandlers())
 * ```
 *
 * @public
 */
export function getHandlers(baseUrl = '*'): HttpHandler[] {
  return [
    // CORS preflight
    http.options('*', () =>
      HttpResponse.text('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }),
    ),

    // Create profile (upsert by events)
    http.post(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/profiles`,
      async ({ request }) => {
        try {
          await ensureFixturesLoaded()
        } catch {
          return fixturesUnavailableResponse()
        }

        const { events } = await parseJson<ExperienceRequestData>(request)
        const { success: eventsAreValid } = ExperienceEventArray.safeParse(events)

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        return HttpResponse.json(getResponseBody(undefined, events), {
          headers: CORS_HEADERS,
        })
      },
    ),

    // Update profile by id
    http.post(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/profiles/:profileId`,
      async ({ params, request }) => {
        try {
          await ensureFixturesLoaded()
        } catch {
          return fixturesUnavailableResponse()
        }

        const { profileId } = params

        if (!profileId) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { headers: CORS_HEADERS, status: 404 },
          )
        }

        const { events } = await parseJson<ExperienceRequestData>(request)
        const { success: eventsAreValid } = ExperienceEventArray.safeParse(events)

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        return HttpResponse.json(getResponseBody(profileId.toString(), events), {
          headers: CORS_HEADERS,
        })
      },
    ),

    // Get profile by id
    http.get(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/profiles/:profileId`,
      async ({ params }) => {
        try {
          await ensureFixturesLoaded()
        } catch {
          return fixturesUnavailableResponse()
        }

        const fixtures = getLoadedFixtures()
        const { profileId } = params

        if (
          !profileId ||
          typeof profileId !== 'string' ||
          ![
            fixtures.identifiedVisitor.data.profile.id,
            fixtures.newVisitor.data.profile.id,
          ].includes(profileId)
        ) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { status: 404, headers: CORS_HEADERS },
          )
        }

        return HttpResponse.json(getResponseBody(profileId), {
          headers: CORS_HEADERS,
        })
      },
    ),

    // Batch upsert profiles (max limits are not enforced in this mock)
    http.post(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/events`,
      async ({ request }) => {
        try {
          await ensureFixturesLoaded()
        } catch {
          return fixturesUnavailableResponse()
        }

        const { events } = await parseJson<{ events: BatchExperienceEventArray }>(request)
        const { success: eventsAreValid } = BatchExperienceEventArray.safeParse(events)

        const profileId = events.find((event) => event.anonymousId)?.anonymousId

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Batch Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        // Just send one, no matter what
        return HttpResponse.json(
          { data: { profiles: [getResponseBody(profileId, events)] } },
          {
            headers: CORS_HEADERS,
          },
        )
      },
    ),

    http.post(`${baseUrl}reset-state`, () => {
      identifiedState = {}

      return HttpResponse.json(
        { message: 'Internal state has been reset' },
        {
          headers: CORS_HEADERS,
        },
      )
    }),
  ]
}
