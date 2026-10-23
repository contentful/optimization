import { batch, signals } from '@contentful/optimization-core'
import type { Profile } from '@contentful/optimization-core/api-schemas'
import ContentfulOptimization, { type OptimizationWebConfig } from './ContentfulOptimization'
import { ANONYMOUS_ID_COOKIE } from './constants'
import { EntryInteractionRuntime } from './entry-tracking/EntryInteractionRuntime'
import * as cookies from './lib/cookies'

const config: OptimizationWebConfig = {
  spaceId: 'key_123',
  environment: 'main',
  defaults: { consent: false, persistenceConsent: true },
  autoTrackEntryInteraction: { clicks: false, hovers: false, views: false },
}

const profile: Profile = {
  id: 'replacement-profile',
  stableId: 'replacement-profile',
  random: 1,
  audiences: [],
  traits: {},
  location: {},
  session: {
    id: 'session-id',
    isReturningVisitor: false,
    landingPage: {
      path: '/',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: 'https://example.test/',
    },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  },
}

function createWeb(options: OptimizationWebConfig = config): ContentfulOptimization {
  const web = new ContentfulOptimization(options)

  rs.spyOn(web.api.insights, 'sendBatchEvents').mockResolvedValue(true)
  rs.spyOn(web.api.experience, 'upsertProfile').mockResolvedValue({
    profile,
    changes: [],
    selectedOptimizations: [],
  })

  return web
}

describe('ContentfulOptimization lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    cookies.removeCookie(ANONYMOUS_ID_COOKIE)
    batch(() => {
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.changes.value = undefined
      signals.selectedOptimizations.value = undefined
    })
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    rs.restoreAllMocks()
  })

  it('disposes old cookie persistence and interaction effects before replacing the runtime', () => {
    const syncInteractions = rs.spyOn(
      EntryInteractionRuntime.prototype,
      'syncAutoTrackedEntryInteractions',
    )
    const first = createWeb({ ...config, cookie: { domain: 'old.example.test' } })

    first.destroy()
    createWeb({ ...config, cookie: { domain: 'new.example.test' } })
    const setCookie = rs.spyOn(cookies, 'setCookie')

    setCookie.mockClear()
    syncInteractions.mockClear()
    signals.profile.value = profile
    signals.consent.value = true

    expect(setCookie).toHaveBeenCalledTimes(1)
    expect(setCookie).toHaveBeenCalledWith(
      ANONYMOUS_ID_COOKIE,
      profile.id,
      expect.objectContaining({ domain: 'new.example.test' }),
    )
    expect(syncInteractions).toHaveBeenCalledTimes(1)
  })

  it('preserves caller-owned subscriptions across destroy and replacement', () => {
    const first = createWeb()
    const observed: Array<Profile | undefined> = []
    const subscription = first.states.profile.subscribe((value) => observed.push(value))

    try {
      first.destroy()
      createWeb()
      signals.profile.value = profile

      expect(observed.at(-1)).toEqual(profile)
    } finally {
      subscription.unsubscribe()
    }
  })

  it('releases the singleton when browser initialization fails before tracking exists', () => {
    const failure = new Error('Cookie access failed')

    rs.spyOn(cookies, 'getCookie').mockImplementationOnce(() => {
      throw failure
    })

    expect(() => new ContentfulOptimization(config)).toThrow(failure)
    expect(() => createWeb()).not.toThrow()
  })

  it('cleans initialized effects and listeners when browser publication fails', () => {
    const failure = new Error('Browser publication failed')
    const removeListener = rs.spyOn(window, 'removeEventListener')
    const syncInteractions = rs.spyOn(
      EntryInteractionRuntime.prototype,
      'syncAutoTrackedEntryInteractions',
    )

    Object.defineProperty(window, 'contentfulOptimization', {
      configurable: true,
      get: () => undefined,
      set: () => {
        throw failure
      },
    })

    try {
      expect(() => new ContentfulOptimization(config)).toThrow(failure)
    } finally {
      delete window.contentfulOptimization
    }

    expect(removeListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('pagehide', expect.any(Function))
    createWeb()
    const setCookie = rs.spyOn(cookies, 'setCookie')

    syncInteractions.mockClear()
    signals.profile.value = profile
    signals.consent.value = true

    expect(setCookie).toHaveBeenCalledTimes(1)
    expect(syncInteractions).toHaveBeenCalledTimes(1)
  })
})
