import { ExperienceResponse, type ExperienceEvent } from '@contentful/optimization-api-schemas'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { setupServer } from 'msw/node'
import { getHandlers } from './experience-handlers'

const BASE_URL = 'https://experience.example.test/'
const PROFILES_URL = `${BASE_URL}v2/organizations/org/environments/main/profiles`

const server = setupServer(...getHandlers(BASE_URL))

// Only `context.app`/`context.library` differ by platform; the mock's
// resolution logic (see `getResponseBody` in ./experience-handlers.ts) never
// reads these fields, so identical request bodies from different platforms
// must resolve to identical `experiences`/`variants` output.
const PLATFORM_CONTEXTS = {
  reactNative: {
    app: { name: 'optimization-react-native-sdk', version: '1.0.0' },
    library: { name: 'react-native-sdk', version: '1.0.0' },
    channel: 'mobile',
  },
  ios: {
    app: { name: 'optimization-ios-sdk', version: '1.0.0' },
    library: { name: 'ios-sdk', version: '1.0.0' },
    channel: 'mobile',
  },
  android: {
    app: { name: 'optimization-android-sdk', version: '1.0.0' },
    library: { name: 'android-sdk', version: '1.0.0' },
    channel: 'mobile',
  },
  web: {
    app: { name: 'optimization-web-sdk', version: '1.0.0' },
    library: { name: 'web-sdk', version: '1.0.0' },
    channel: 'web',
  },
} as const

function makeIdentifyEvent(
  context: (typeof PLATFORM_CONTEXTS)[keyof typeof PLATFORM_CONTEXTS],
): ExperienceEvent {
  return {
    type: 'identify',
    traits: { identified: true },
    channel: context.channel,
    context: {
      app: context.app,
      campaign: {},
      gdpr: { isConsentGiven: true },
      library: context.library,
      locale: 'en-US',
    },
    messageId: '22222222-2222-4222-8222-222222222222',
    originalTimestamp: '2026-01-01T00:00:00.000Z',
    sentAt: '2026-01-01T00:00:00.000Z',
    timestamp: '2026-01-01T00:00:00.000Z',
  }
}

async function createProfileFrom(
  context: (typeof PLATFORM_CONTEXTS)[keyof typeof PLATFORM_CONTEXTS],
): Promise<ExperienceResponse> {
  const response = await fetch(PROFILES_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: [makeIdentifyEvent(context)] }),
  })

  expect(response.status).toBe(200)

  return ExperienceResponse.parse(await response.json())
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

describe('cross-platform experience resolution consistency', () => {
  it('resolves identical audiences and variants regardless of the requesting platform', async () => {
    const platforms = Object.values(PLATFORM_CONTEXTS)
    const responses = await Promise.all(
      platforms.map(async (context) => await createProfileFrom(context)),
    )

    const [reference, ...rest] = responses

    if (!reference) throw new Error('Expected at least one platform response')

    for (const response of rest) {
      expect(response.data.profile.audiences).toEqual(reference.data.profile.audiences)
      expect(response.data.experiences).toEqual(reference.data.experiences)
    }
  })
})
