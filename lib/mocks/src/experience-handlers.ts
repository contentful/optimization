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

interface ExperienceEvent {
  type: string
}

interface BatchExperienceEvent {
  anonymousId: string
  type: string
}

interface ExperienceResponse {
  data: { profile: { id: string; stableId: string } }
}

export interface Parser<T> {
  parse: (value: unknown) => T
}

export interface SafeParser<T> {
  safeParse: (value: unknown) => { data: T; success: true } | { success: false }
}

export interface ExperienceHandlerDependencies {
  batchExperienceEventArray: SafeParser<readonly BatchExperienceEvent[]>
  experienceEventArray: SafeParser<readonly ExperienceEvent[]>
  experienceResponse: Parser<ExperienceResponse>
}

let identifiedState: State = {}
let knownProfileIds = new Set<string>()

let newVisitor: ExperienceResponse | undefined = undefined
let identifiedVisitor: ExperienceResponse | undefined = undefined
let fixtureLoadPromise: Promise<void> | undefined = undefined
let fixtureLoadError: unknown = undefined

async function loadFixtures(dependencies: ExperienceHandlerDependencies): Promise<void> {
  const [newVisitorData, identifiedVisitorData] = await Promise.all([
    readFile(newVisitorPath, 'utf8'),
    readFile(identifiedVisitorPath, 'utf8'),
  ])

  newVisitor = dependencies.experienceResponse.parse(JSON.parse(newVisitorData))
  identifiedVisitor = dependencies.experienceResponse.parse(JSON.parse(identifiedVisitorData))
  resetState()
}

async function ensureFixturesLoaded(dependencies: ExperienceHandlerDependencies): Promise<void> {
  fixtureLoadPromise ??= loadFixtures(dependencies).catch((error: unknown) => {
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

function resetState(): void {
  identifiedState = {}
  knownProfileIds = new Set()

  if (newVisitor) knownProfileIds.add(newVisitor.data.profile.id)
  if (identifiedVisitor) knownProfileIds.add(identifiedVisitor.data.profile.id)
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

function hasIdentifyEvent(events: readonly ExperienceEvent[] | undefined): boolean {
  if (!events?.length) return false

  return events.some(({ type }) => type === 'identify')
}

function getResponseBody(
  profileId?: string,
  events?: readonly ExperienceEvent[],
): ExperienceResponse {
  const fixtures = getLoadedFixtures()

  profileId ??= crypto.randomUUID()
  knownProfileIds.add(profileId)

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
 * Returns MSW request handlers that mock the Experience API v3 endpoints.
 *
 * @param dependencies - Injected schema parsers for Experience API requests and fixtures.
 * @param baseUrl - URL prefix prepended to each route pattern.
 * @returns An array of {@link HttpHandler} instances for use with MSW.
 *
 * @example
 * ```typescript
 * import {
 *   BatchExperienceEventArray,
 *   ExperienceEventArray,
 *   ExperienceResponse,
 * } from '@contentful/optimization-api-client/api-schemas'
 * import { setupServer } from 'msw/node'
 * import { getHandlers } from './experience-handlers'
 *
 * const dependencies = {
 *   batchExperienceEventArray: BatchExperienceEventArray,
 *   experienceEventArray: ExperienceEventArray,
 *   experienceResponse: ExperienceResponse,
 * }
 * const server = setupServer(...getHandlers(dependencies))
 * ```
 *
 * @public
 */
export function getHandlers(
  dependencies: ExperienceHandlerDependencies,
  baseUrl = '*',
): HttpHandler[] {
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
      `${baseUrl}v3/spaces/:spaceId/environments/:environment/profiles`,
      async ({ request }) => {
        try {
          await ensureFixturesLoaded(dependencies)
        } catch {
          return fixturesUnavailableResponse()
        }

        const { events } = await parseJson<{ events: unknown }>(request)
        const parsedEvents = dependencies.experienceEventArray.safeParse(events)

        if (!parsedEvents.success) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        return HttpResponse.json(getResponseBody(undefined, parsedEvents.data), {
          headers: CORS_HEADERS,
        })
      },
    ),

    // Update profile by id
    http.post(
      `${baseUrl}v3/spaces/:spaceId/environments/:environment/profiles/:profileId`,
      async ({ params, request }) => {
        try {
          await ensureFixturesLoaded(dependencies)
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

        const { events } = await parseJson<{ events: unknown }>(request)
        const parsedEvents = dependencies.experienceEventArray.safeParse(events)

        if (!parsedEvents.success) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        return HttpResponse.json(getResponseBody(profileId.toString(), parsedEvents.data), {
          headers: CORS_HEADERS,
        })
      },
    ),

    // Get profile by id
    http.get(
      `${baseUrl}v3/spaces/:spaceId/environments/:environment/profiles/:profileId`,
      async ({ params }) => {
        try {
          await ensureFixturesLoaded(dependencies)
        } catch {
          return fixturesUnavailableResponse()
        }

        const { profileId } = params

        if (!profileId || typeof profileId !== 'string' || !knownProfileIds.has(profileId)) {
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
      `${baseUrl}v3/spaces/:spaceId/environments/:environment/events`,
      async ({ request }) => {
        try {
          await ensureFixturesLoaded(dependencies)
        } catch {
          return fixturesUnavailableResponse()
        }

        const { events } = await parseJson<{ events: unknown }>(request)
        const parsedEvents = dependencies.batchExperienceEventArray.safeParse(events)

        if (!parsedEvents.success) {
          return HttpResponse.json(
            { error: 'Invalid Batch Event Array' },
            { headers: CORS_HEADERS, status: 400 },
          )
        }

        const profileId = parsedEvents.data.find((event) => event.anonymousId)?.anonymousId

        // Just send one, no matter what
        return HttpResponse.json(
          { data: { profiles: [getResponseBody(profileId, parsedEvents.data)] } },
          {
            headers: CORS_HEADERS,
          },
        )
      },
    ),

    http.post(`${baseUrl}reset-state`, () => {
      resetState()

      return HttpResponse.json(
        { message: 'Internal state has been reset' },
        {
          headers: CORS_HEADERS,
        },
      )
    }),
  ]
}
