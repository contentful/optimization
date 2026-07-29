import { ExperienceResponse, type ExperienceEvent } from '@contentful/optimization-api-schemas'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { setupServer } from 'msw/node'
import { getHandlers } from './experience-handlers'

const BASE_URL = 'https://experience.example.test/'
const PROFILES_URL = `${BASE_URL}v2/organizations/org/environments/main/profiles`
const FIXTURE_PROFILE_ID = 'f0837a67eed5f1c93978f6d53fa948df93897137bcd048366f30ba590420754b'

const server = setupServer(...getHandlers(BASE_URL))

function makeTrackEvent(): ExperienceEvent {
  return {
    type: 'track',
    event: 'created-profile-regression',
    properties: {},
    channel: 'web',
    context: {
      app: { name: 'test-app', version: '1.0.0' },
      campaign: {},
      gdpr: { isConsentGiven: true },
      library: { name: 'test-lib', version: '1.0.0' },
      locale: 'en-US',
    },
    messageId: 'created-profile-regression',
    originalTimestamp: '2026-01-01T00:00:00.000Z',
    sentAt: '2026-01-01T00:00:00.000Z',
    timestamp: '2026-01-01T00:00:00.000Z',
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(async () => {
  server.resetHandlers()
  await fetch(`${BASE_URL}reset-state`, { method: 'POST' })
})

afterAll(() => {
  server.close()
})

describe('experience handlers', () => {
  it('returns a seeded fixture profile by id', async () => {
    const fetchedResponse = await fetch(`${PROFILES_URL}/${FIXTURE_PROFILE_ID}`)

    expect(fetchedResponse.status).toBe(200)

    const fetchedJson: unknown = await fetchedResponse.json()
    const fetched = ExperienceResponse.parse(fetchedJson)

    expect(fetched.data.profile.id).toBe(FIXTURE_PROFILE_ID)
    expect(fetched.data.profile.stableId).toBe(FIXTURE_PROFILE_ID)
  })

  it('returns a created profile by its generated id', async () => {
    const createdResponse = await fetch(PROFILES_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [makeTrackEvent()] }),
    })

    expect(createdResponse.status).toBe(200)

    const createdJson: unknown = await createdResponse.json()
    const created = ExperienceResponse.parse(createdJson)
    const profileId = created.data.profile.id

    const fetchedResponse = await fetch(`${PROFILES_URL}/${encodeURIComponent(profileId)}`)

    expect(fetchedResponse.status).toBe(200)

    const fetchedJson: unknown = await fetchedResponse.json()
    const fetched = ExperienceResponse.parse(fetchedJson)

    expect(fetched.data.profile.id).toBe(profileId)
    expect(fetched.data.profile.stableId).toBe(profileId)
  })

  it('returns an updated profile by id', async () => {
    const profileId = 'updated-profile-id'
    const updatedResponse = await fetch(`${PROFILES_URL}/${profileId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [makeTrackEvent()] }),
    })

    expect(updatedResponse.status).toBe(200)

    const fetchedResponse = await fetch(`${PROFILES_URL}/${profileId}`)

    expect(fetchedResponse.status).toBe(200)

    const fetchedJson: unknown = await fetchedResponse.json()
    const fetched = ExperienceResponse.parse(fetchedJson)

    expect(fetched.data.profile.id).toBe(profileId)
    expect(fetched.data.profile.stableId).toBe(profileId)
  })

  it('returns profile not found for unknown profile ids', async () => {
    const fetchedResponse = await fetch(`${PROFILES_URL}/stale-profile-id`)

    expect(fetchedResponse.status).toBe(404)

    const fetchedJson: unknown = await fetchedResponse.json()

    expect(fetchedJson).toEqual(
      expect.objectContaining({ error: { code: 'ERR_PROFILE_NOT_FOUND' } }),
    )
  })
})
