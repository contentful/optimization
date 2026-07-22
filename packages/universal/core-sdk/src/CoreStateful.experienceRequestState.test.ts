import type { ExperienceResponse } from '@contentful/optimization-api-schemas'
import { http, HttpResponse } from 'msw'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, signals, type ExperienceRequestState } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'
import { server } from './test/setup'

const EXPERIENCE_BASE_URL = 'https://experience.ninetailed.co/'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
  defaults: { consent: true },
}

const SUCCESS_BODY: ExperienceResponse = {
  data: {
    profile: profileFixture,
    experiences: [],
    changes: [],
  },
  message: 'OK',
  error: null,
}

const observe = (): {
  states: ExperienceRequestState[]
  unsubscribe: () => void
} => {
  const states: ExperienceRequestState[] = []
  const unsubscribe = signals.experienceRequestState.subscribe((value) => {
    states.push(value)
  })
  return { states, unsubscribe }
}

describe('CoreStateful experienceRequestState end-to-end', () => {
  const createdCores: CoreStateful[] = []

  beforeEach(() => {
    batch(() => {
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
      signals.changes.value = undefined
      signals.experienceRequestState.value = { status: 'idle' }
      signals.online.value = true
    })
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      const core = createdCores.pop()
      core?.destroy()
    }
    batch(() => {
      signals.experienceRequestState.value = { status: 'idle' }
      signals.selectedOptimizations.value = undefined
    })
  })

  const createCore = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({ ...config, ...overrides })
    createdCores.push(core)
    return core
  }

  it('publishes idle as the initial value to new subscribers', () => {
    const { states, unsubscribe } = observe()
    expect(states).toEqual([{ status: 'idle' }])
    unsubscribe()
  })

  it('flips idle -> pending -> success when the Experience API responds 200', async () => {
    server.use(
      http.post(`${EXPERIENCE_BASE_URL}v3/spaces/:org/environments/:env/profiles`, () =>
        HttpResponse.json(SUCCESS_BODY, { status: 200 }),
      ),
    )

    const core = createCore()
    const { states, unsubscribe } = observe()

    await core.page({})

    expect(states).toEqual([{ status: 'idle' }, { status: 'pending' }, { status: 'success' }])
    expect(signals.selectedOptimizations.value).toBeDefined()

    unsubscribe()
  })

  it('flips idle -> pending -> failed:api-error on a 500 response', async () => {
    server.use(
      http.post(`${EXPERIENCE_BASE_URL}v3/spaces/:org/environments/:env/profiles`, () =>
        HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
      ),
    )

    const core = createCore()
    const { states, unsubscribe } = observe()

    await core.page({}).catch(() => undefined)

    expect(states).toEqual([
      { status: 'idle' },
      { status: 'pending' },
      { status: 'failed', reason: 'api-error' },
    ])
    expect(signals.selectedOptimizations.value).toBeUndefined()

    unsubscribe()
  })

  // The api-client's retry layer rethrows aborted requests as a generic Error
  // (`createRetryFetchMethod.ts:"may not be retried"`), which loses the original
  // `AbortError` identity. Today the queue cannot distinguish a timeout from
  // a non-2xx response and reports both as `failed:api-error`. The reason
  // union still allows for `timeout` so a future api-client change that
  // preserves error identity (or a non-retry-wrapped platform) can emit it
  // without breaking the public contract.
  it('flips idle -> pending -> failed:api-error when the request times out', async () => {
    server.use(
      http.post(`${EXPERIENCE_BASE_URL}v3/spaces/:org/environments/:env/profiles`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return HttpResponse.json(SUCCESS_BODY, { status: 200 })
      }),
    )

    const core = createCore({ fetchOptions: { requestTimeout: 25 } })
    const { states, unsubscribe } = observe()

    await core.page({}).catch(() => undefined)

    expect(states).toEqual([
      { status: 'idle' },
      { status: 'pending' },
      { status: 'failed', reason: 'api-error' },
    ])
    expect(signals.selectedOptimizations.value).toBeUndefined()

    unsubscribe()
  })

  it('overwrites a terminal failed state with pending on the next request', async () => {
    server.use(
      http.post(`${EXPERIENCE_BASE_URL}v3/spaces/:org/environments/:env/profiles`, () =>
        HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
      ),
    )

    const core = createCore()

    await core.page({}).catch(() => undefined)
    expect(signals.experienceRequestState.value).toEqual({
      status: 'failed',
      reason: 'api-error',
    })

    server.use(
      http.post(`${EXPERIENCE_BASE_URL}v3/spaces/:org/environments/:env/profiles`, () =>
        HttpResponse.json(SUCCESS_BODY, { status: 200 }),
      ),
    )

    const { states, unsubscribe } = observe()

    await core.page({})

    expect(states).toEqual([
      { status: 'failed', reason: 'api-error' },
      { status: 'pending' },
      { status: 'success' },
    ])

    unsubscribe()
  })
})
