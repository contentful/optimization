import { http, type HttpHandler, HttpResponse } from 'msw'
import type { OptimizationDataType, OptimizationRequestDataType } from '../lib/api-client'
import type {
  BatchEventType,
  BatchEventArrayType,
  EventType,
  EventArrayType,
} from '../lib/api-client/experience/dto/event'
import type {
  GeoLocationType,
  PageType,
  TraitsType,
} from '../lib/api-client/experience/dto/event/properties'
import type { ExperienceType } from '../lib/api-client/experience/dto/experience'
import type { ProfileType } from '../lib/api-client/experience/dto/profile'
import type { SessionStatisticsType } from '../lib/api-client/experience/dto/profile/properties'

// Minimal in-memory store
const profilesStore = new Map<string, ProfileType>()

// eslint-disable-next-line complexity -- no worries
function makeDefaultSession(page?: PageType): SessionStatisticsType {
  const path = page?.path ?? '/'
  const url = page?.url ?? 'https://example.com/'
  const query = page?.query ?? {}
  const referrer = page?.referrer ?? ''
  const search = page?.search ?? ''
  const title = page?.title ?? ''
  return {
    id: 'sess_' + crypto.randomUUID(),
    isReturningVisitor: false,
    landingPage: { path, url, query, referrer, search, title },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  }
}

function isBatchEvent(event: EventType | BatchEventType): event is BatchEventType {
  return Boolean(Object.keys(event).find((k) => k === 'anonymousId'))
}

function createProfileFromEvents(
  events: EventArrayType | BatchEventArrayType,
  explicitId?: string,
): ProfileType {
  const [first] = events

  if (!first) throw new Error('At least one event must be supplied')

  const anonymousId = isBatchEvent(first) ? first.anonymousId : 'prf_' + crypto.randomUUID()
  const generatedId = explicitId ?? anonymousId
  const stableId = generatedId

  // Merge traits from any identify events (last write wins)
  const traits = events.reduce<TraitsType>((acc, e) => {
    if (e.type === 'identify') {
      Object.assign(acc, e.traits)
    }
    return acc
  }, {})

  // Prefer event-provided location if present
  const loc: GeoLocationType = Object.assign({}, first.context.location)

  const random = seededRandom(stableId)
  const {
    context: { page },
  } = first

  return {
    id: generatedId,
    stableId,
    random,
    audiences: inferAudiences({ traits, page }),
    traits,
    location: loc,
    session: makeDefaultSession(page),
  }
}

function updateProfileWithEvents(profile: ProfileType, events: EventArrayType): ProfileType {
  for (const e of events) {
    if (e.type === 'identify') {
      Object.assign(profile.traits, e.traits)
    }
    // Very simple session math for mocking
    profile.session.count += 1
  }
  profile.audiences = inferAudiences({ traits: profile.traits })
  return profile
}

// Deterministic pseudo-random so variants are stable per profile id
function seededRandom(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

function inferAudiences({ traits, page }: { traits?: TraitsType; page?: PageType }): string[] {
  const out: string[] = []
  if (traits?.countryCode === 'DE') out.push('audience-germany')
  if (traits?.plan === 'pro') out.push('audience-pro')
  if (page?.query.utm_campaign) out.push(`utm-${page.query.utm_campaign}`)
  return out
}

function chooseExperiences(profile: ProfileType): ExperienceType[] {
  // A tiny decision engine just to demonstrate shape
  // You can replace this with any logic or even read from a JSON config.
  const variantIndex = profile.traits.beta ? 1 : profile.random > 0.5 ? 1 : 0
  const variants =
    variantIndex === 0
      ? { entryA: 'entryA', entryB: 'entryB' }
      : { entryA: 'entryC', entryB: 'entryD' }

  return [
    {
      experienceId: 'exp-home-hero',
      variantIndex,
      variants,
    },
  ]
}

// Helper to parse JSON whether body is application/json or text/plain
async function parseJson<T>(req: Request): Promise<T> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
    return (await req.json()) as T
  }
  // text/plain or others -> try text then JSON.parse
  const raw = await req.text()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
  return JSON.parse(raw) as T
}

// Common response helper
function buildResponse(
  profile: ProfileType | ProfileType[],
): OptimizationDataType | OptimizationDataType[] {
  if (Array.isArray(profile)) {
    return profile.map((p) => ({ profile: p, experiences: chooseExperiences(p), changes: [] }))
  }
  return { profile, experiences: chooseExperiences(profile), changes: [] }
}

// ---------------------------------
// MSW handlers for Experience API v2
// ---------------------------------
export function getHandlers(baseUrl = '*'): HttpHandler[] {
  return [
    // Create profile (upsert by events)
    http.post(
      `${baseUrl}/v2/organizations/:organizationId/environments/:environmentSlug/profiles`,
      async ({ request }) => {
        const { events } = await parseJson<OptimizationRequestDataType>(request)
        const profile = createProfileFromEvents(events)
        profilesStore.set(profile.id, profile)
        return HttpResponse.json(buildResponse(profile))
      },
    ),

    // Update profile by id
    http.post(
      `${baseUrl}/v2/organizations/:organizationId/environments/:environmentSlug/profiles/:profileId`,
      async ({ params, request }) => {
        const { profileId } = params
        const { events } = await parseJson<OptimizationRequestDataType>(request)

        if (!profileId) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { status: 404 },
          )
        }

        let profile = profilesStore.get(profileId.toString())
        if (!profile) {
          profile = createProfileFromEvents(events, profileId.toString())
          profilesStore.set(profileId.toString(), profile)
        } else {
          updateProfileWithEvents(profile, events)
        }

        return HttpResponse.json(buildResponse(profile))
      },
    ),

    // Get profile by id
    http.get(
      `${baseUrl}/v2/organizations/:organizationId/environments/:environmentSlug/profiles/:profileId`,
      ({ params }) => {
        const { profileId } = params
        const profile = profileId ? profilesStore.get(profileId.toString()) : undefined
        if (!profile) {
          return HttpResponse.json(
            { message: 'Profile not found', data: {}, error: { code: 'ERR_PROFILE_NOT_FOUND' } },
            { status: 404 },
          )
        }
        return HttpResponse.json(buildResponse(profile))
      },
    ),

    // Batch upsert profiles (max limits are not enforced in this mock)
    http.post(
      `${baseUrl}/v2/organizations/:organizationId/environments/:environmentSlug/events`,
      async ({ request }) => {
        const { events } = await parseJson<{ events: BatchEventArrayType }>(request)

        // Group incoming events by anonymousId (or synthesize one per event if missing)
        const byId = new Map<string, EventType[]>()
        for (const ev of events) {
          const { anonymousId: id } = ev
          const list = byId.get(id)
          if (list) list.push(ev)
          else byId.set(id, [ev])
        }

        const changed: ProfileType[] = []

        for (const [id, evs] of byId) {
          let profile = profilesStore.get(id)
          if (!profile) {
            profile = createProfileFromEvents(evs, id)
            profilesStore.set(id, profile)
          } else {
            updateProfileWithEvents(profile, evs)
          }
          changed.push(profile)
        }

        return HttpResponse.json(buildResponse(changed))
      },
    ),
  ]
}
