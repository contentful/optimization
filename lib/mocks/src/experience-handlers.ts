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

type State = Record<string, boolean>

let identifiedState: State = {}

let newVisitor: ExperienceResponse | undefined = undefined
readFile(newVisitorPath, 'utf8')
  .then((data) => ExperienceResponse.parse(JSON.parse(data)))
  .then((data) => (newVisitor = data))
  .catch((error: unknown) => {
    void error
  })

let identifiedVisitor: ExperienceResponse | undefined = undefined
readFile(identifiedVisitorPath, 'utf8')
  .then((data) => ExperienceResponse.parse(JSON.parse(data)))
  .then((data) => (identifiedVisitor = data))
  .catch((error: unknown) => {
    void error
  })

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

function getResponseBody(
  profileId?: string,
  events?: ExperienceEventArray,
): ExperienceResponse | undefined {
  profileId ??= crypto.randomUUID()

  const identified = identifiedState[profileId] ?? false

  let responseBody: ExperienceResponse | undefined = undefined

  if (identified || hasIdentifyEvent(events)) {
    if (profileId) identifiedState[profileId] ||= true

    responseBody = cloneDeep(identifiedVisitor)
  } else {
    responseBody = cloneDeep(newVisitor)
  }

  if (responseBody) {
    responseBody.data.profile.id = profileId
    responseBody.data.profile.stableId = profileId
  }

  return responseBody
}

// ---------------------------------
// MSW handlers for Experience API v2
// ---------------------------------
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
        const { events } = await parseJson<ExperienceRequestData>(request)
        const { success: eventsAreValid } = ExperienceEventArray.safeParse(events)

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 400 },
          )
        }

        return HttpResponse.json(getResponseBody(undefined, events), {
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      },
    ),

    // Update profile by id
    http.post(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/profiles/:profileId`,
      async ({ params, request }) => {
        const { profileId } = params

        if (!profileId) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 404 },
          )
        }

        const { events } = await parseJson<ExperienceRequestData>(request)
        const { success: eventsAreValid } = ExperienceEventArray.safeParse(events)

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Event Array' },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 400 },
          )
        }
        const identified = getResponseBody(events)

        if (identified) {
          const {
            data: {
              profile: { id, ...profile },
              ...data
            },
            ...rest
          } = identified

          return HttpResponse.json(
            { data: { ...data, profile: { id: profileId, ...profile } }, ...rest },
            {
              headers: { 'Access-Control-Allow-Origin': '*' },
            },
          )
        }

        return HttpResponse.json(identified, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      },
    ),

    // Get profile by id
    http.get(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/profiles/:profileId`,
      ({ params }) => {
        const { profileId } = params

        if (
          !profileId ||
          typeof profileId !== 'string' ||
          ![identifiedVisitor?.data.profile.id, newVisitor?.data.profile.id].includes(profileId)
        ) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } },
          )
        }

        return HttpResponse.json(getResponseBody(profileId), {
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      },
    ),

    // Batch upsert profiles (max limits are not enforced in this mock)
    http.post(
      `${baseUrl}v2/organizations/:organizationId/environments/:environment/events`,
      async ({ request }) => {
        const { events } = await parseJson<{ events: BatchExperienceEventArray }>(request)
        const { success: eventsAreValid } = BatchExperienceEventArray.safeParse(events)

        const profileId = events.find((event) => event.anonymousId)?.anonymousId

        if (!eventsAreValid) {
          return HttpResponse.json(
            { error: 'Invalid Batch Event Array' },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 400 },
          )
        }

        // Just send one, no matter what
        return HttpResponse.json(
          { data: { profiles: [getResponseBody(profileId, events)] } },
          {
            headers: { 'Access-Control-Allow-Origin': '*' },
          },
        )
      },
    ),

    http.post(`${baseUrl}reset-state`, () => {
      identifiedState = {}

      return HttpResponse.json(
        { message: 'Internal state has been reset' },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      )
    }),
  ]
}
