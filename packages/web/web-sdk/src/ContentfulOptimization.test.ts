import { batch, signals, type CoreConfig } from '@contentful/optimization-core'
import type { OptimizationData, Profile } from '@contentful/optimization-core/api-schemas'
import {
  ANONYMOUS_ID_COOKIE,
  ANONYMOUS_ID_COOKIE_LEGACY,
  ANONYMOUS_ID_KEY,
  CONSENT_KEY,
  PERSISTENCE_CONSENT_KEY,
  PROFILE_CACHE_KEY,
} from '@contentful/optimization-core/constants'
import ContentfulOptimization from './ContentfulOptimization'
import { OPTIMIZATION_WEB_SDK_NAME } from './constants'
import { getCookie, removeCookie, setCookie } from './lib/cookies'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const DEFAULT_PROFILE: Profile = {
  id: 'profile-id',
  stableId: 'profile-id',
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

const EMPTY_OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: DEFAULT_PROFILE,
}

interface AutoTrackState {
  clicks: boolean
  hovers: boolean
  views: boolean
}

function isAutoTrackState(value: unknown): value is AutoTrackState {
  if (!value || typeof value !== 'object') return false

  const clicks = Reflect.get(value, 'clicks')
  const hovers = Reflect.get(value, 'hovers')
  const views = Reflect.get(value, 'views')

  return typeof clicks === 'boolean' && typeof hovers === 'boolean' && typeof views === 'boolean'
}

const getAutoTrackState = (
  contentfulOptimization: ContentfulOptimization,
): AutoTrackState | undefined => {
  const runtime = Reflect.get(contentfulOptimization, 'entryInteractionRuntime')
  const value = Reflect.get(runtime, 'autoTrack')

  return isAutoTrackState(value) ? value : undefined
}

const getAutoTrackEntryViews = (
  contentfulOptimization: ContentfulOptimization,
): boolean | undefined => {
  const state = getAutoTrackState(contentfulOptimization)

  return state?.views
}

const getAutoTrackEntryClicks = (
  contentfulOptimization: ContentfulOptimization,
): boolean | undefined => {
  const state = getAutoTrackState(contentfulOptimization)

  return state?.clicks
}

const getAutoTrackEntryHovers = (
  contentfulOptimization: ContentfulOptimization,
): boolean | undefined => {
  const state = getAutoTrackState(contentfulOptimization)

  return state?.hovers
}

describe('ContentfulOptimization', () => {
  beforeEach(() => {
    delete window.contentfulOptimization
    localStorage.clear()
    removeCookie(ANONYMOUS_ID_COOKIE)
    removeCookie(ANONYMOUS_ID_COOKIE_LEGACY)
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.locale.value = undefined
      signals.online.value = true
      signals.persistenceConsent.value = undefined
      signals.previewPanelAttached.value = false
      signals.previewPanelOpen.value = false
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
    })
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    rs.restoreAllMocks()
  })

  it('sets configured options', () => {
    const web = new ContentfulOptimization(config)

    expect(web.config.clientId).toEqual(CLIENT_ID)
    expect(web.eventBuilder.library.name).toEqual(OPTIMIZATION_WEB_SDK_NAME)
  })

  it('uses top-level locale as the SDK Experience API/event locale', () => {
    const web = new ContentfulOptimization({
      ...config,
      locale: ' de_DE ',
    })

    expect(web.locale).toBe('de-DE')
    expect(Reflect.get(web.api.experience, 'locale')).toBe('de-DE')
    expect(web.eventBuilder.buildPageView({}).context.locale).toBe('de-DE')
  })

  it('omits the Experience API locale when top-level locale is omitted', () => {
    const web = new ContentfulOptimization(config)

    expect(web.locale).toBeUndefined()
    expect(Reflect.get(web.api.experience, 'locale')).toBeUndefined()
  })

  it('updates the live locale without refreshing optimization data', () => {
    const web = new ContentfulOptimization({
      ...config,
      locale: 'en-US',
    })
    const page = rs.spyOn(web, 'page')
    const values: Array<string | undefined> = []
    const subscription = web.states.locale.subscribe((locale) => {
      values.push(locale)
    })

    const nextLocale = web.setLocale(' de_DE ')

    expect(nextLocale).toBe('de-DE')
    expect(web.locale).toBe('de-DE')
    expect(Reflect.get(web.api.experience, 'locale')).toBe('de-DE')
    expect(page).not.toHaveBeenCalled()
    expect(values).toEqual(['en-US', 'de-DE'])

    subscription.unsubscribe()
  })

  it('defaults autoTrackEntryInteraction.views/clicks/hovers to true when omitted', () => {
    const web = new ContentfulOptimization(config)

    expect(getAutoTrackEntryViews(web)).toBe(true)
    expect(getAutoTrackEntryClicks(web)).toBe(true)
    expect(getAutoTrackEntryHovers(web)).toBe(true)
  })

  it('uses autoTrackEntryInteraction.views=false when configured', () => {
    const web = new ContentfulOptimization({
      ...config,
      autoTrackEntryInteraction: { views: false },
    })

    expect(getAutoTrackEntryViews(web)).toBe(false)
    expect(getAutoTrackEntryClicks(web)).toBe(true)
    expect(getAutoTrackEntryHovers(web)).toBe(true)
  })

  it('uses autoTrackEntryInteraction.clicks=false when configured', () => {
    const web = new ContentfulOptimization({
      ...config,
      autoTrackEntryInteraction: { clicks: false },
    })

    expect(getAutoTrackEntryViews(web)).toBe(true)
    expect(getAutoTrackEntryClicks(web)).toBe(false)
    expect(getAutoTrackEntryHovers(web)).toBe(true)
  })

  it('uses autoTrackEntryInteraction.hovers=false when configured', () => {
    const web = new ContentfulOptimization({
      ...config,
      autoTrackEntryInteraction: { hovers: false },
    })

    expect(getAutoTrackEntryViews(web)).toBe(true)
    expect(getAutoTrackEntryClicks(web)).toBe(true)
    expect(getAutoTrackEntryHovers(web)).toBe(false)
  })

  it('supports generic interaction APIs for entry view tracking', () => {
    const web = new ContentfulOptimization(config)
    const element = document.createElement('div')

    web.tracking.enable('views')
    web.tracking.enableElement('views', element, { data: { entryId: 'entry-123' } })
    web.tracking.disableElement('views', element)
    web.tracking.clearElement('views', element)
    web.tracking.disable('views')

    expect(getAutoTrackEntryViews(web)).toBe(false)
  })

  it('supports generic interaction APIs for entry click tracking', () => {
    const web = new ContentfulOptimization(config)
    const element = document.createElement('div')

    web.tracking.enable('clicks')
    web.tracking.enableElement('clicks', element, { data: { entryId: 'entry-123' } })
    web.tracking.disableElement('clicks', element)
    web.tracking.clearElement('clicks', element)
    web.tracking.disable('clicks')

    expect(getAutoTrackEntryClicks(web)).toBe(false)
  })

  it('supports generic interaction APIs for entry hover tracking', () => {
    const web = new ContentfulOptimization(config)
    const element = document.createElement('div')

    web.tracking.enable('hovers')
    web.tracking.enableElement('hovers', element, { data: { entryId: 'entry-123' } })
    web.tracking.disableElement('hovers', element)
    web.tracking.clearElement('hovers', element)
    web.tracking.disable('hovers')

    expect(getAutoTrackEntryHovers(web)).toBe(false)
  })

  it('defaults allowedEventTypes to identify/page for web', async () => {
    const onEventBlocked = rs.fn()
    const web = new ContentfulOptimization({
      ...config,
      onEventBlocked,
    })
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await web.identify({ userId: 'user-123' })
    await web.page({})
    await web.track({ event: 'purchase' })

    expect(upsertProfile).toHaveBeenCalledTimes(2)
    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'consent',
        method: 'track',
      }),
    )
  })

  it('uses user-provided allowedEventTypes when configured', async () => {
    const onEventBlocked = rs.fn()
    const web = new ContentfulOptimization({
      ...config,
      allowedEventTypes: ['identify', 'page', 'track'],
      onEventBlocked,
    })
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await web.track({ event: 'purchase' })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).not.toHaveBeenCalled()
  })

  it('keeps explicit default profile in memory until persistence consent is granted', () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: {
        profile: DEFAULT_PROFILE,
      },
    })

    expect(web.states.profile.current).toEqual(DEFAULT_PROFILE)
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()

    web.consent({ persistence: true })

    expect(JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? 'null')).toEqual(DEFAULT_PROFILE)
  })

  it('clears durable profile continuity on persistence consent withdrawal without clearing memory', () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        profile: DEFAULT_PROFILE,
      },
    })

    expect(localStorage.getItem(PROFILE_CACHE_KEY)).not.toBeNull()

    web.consent({ persistence: false })

    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
    expect(web.states.profile.current).toEqual(DEFAULT_PROFILE)
  })

  it('preserves the anonymous ID when profile continuity is cleared while persistence consent remains granted', () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        profile: DEFAULT_PROFILE,
      },
    })

    expect(web.states.profile.current).toEqual(DEFAULT_PROFILE)
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(DEFAULT_PROFILE.id)

    signals.profile.value = undefined

    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(DEFAULT_PROFILE.id)
  })

  it('preserves SSR optimization defaults when adopting a matching anonymous ID cookie', () => {
    const serverAnonymousId = 'server-anonymous-id'
    const serverProfile = {
      ...DEFAULT_PROFILE,
      id: serverAnonymousId,
      stableId: serverAnonymousId,
    }
    const selectedOptimizations: OptimizationData['selectedOptimizations'] = [
      {
        experienceId: 'experience-id',
        variantIndex: 1,
        variants: { baseline: 'variant' },
        sticky: false,
      },
    ]
    const changes: OptimizationData['changes'] = [
      {
        key: 'boolean',
        type: 'Variable',
        value: true,
        meta: {
          experienceId: 'experience-id',
          variantIndex: 1,
        },
      },
    ]
    setCookie(ANONYMOUS_ID_COOKIE, serverAnonymousId)

    const web = new ContentfulOptimization({
      ...config,
      defaults: {
        changes,
        consent: true,
        profile: serverProfile,
        selectedOptimizations,
      },
    })

    expect(web.states.profile.current).toEqual(serverProfile)
    expect(web.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(web.states.consent.current).toBe(true)
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(serverAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe(serverAnonymousId)
  })

  it('adopts an SSR anonymous ID cookie when persistence consent is granted after initialization', async () => {
    const serverAnonymousId = 'server-anonymous-id'
    const serverProfile = {
      ...DEFAULT_PROFILE,
      id: serverAnonymousId,
      stableId: serverAnonymousId,
    }
    setCookie(ANONYMOUS_ID_COOKIE, serverAnonymousId)

    const web = new ContentfulOptimization(config)
    const upsertProfile = rs.spyOn(web.api.experience, 'upsertProfile').mockResolvedValue({
      ...EMPTY_OPTIMIZATION_DATA,
      profile: serverProfile,
    })

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBeNull()

    web.consent({ persistence: true })

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(serverAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe(serverAnonymousId)

    await web.page()

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: serverAnonymousId,
      }),
    )
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(serverAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe(serverAnonymousId)
  })

  it('adopts a legacy anonymous ID cookie when persistence consent is granted after initialization', () => {
    const legacyAnonymousId = 'legacy-anonymous-id'
    setCookie(ANONYMOUS_ID_COOKIE_LEGACY, legacyAnonymousId)

    const web = new ContentfulOptimization(config)

    web.consent({ persistence: true })

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(legacyAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe(legacyAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE_LEGACY)).toBeUndefined()
  })

  it('writes the current anonymous ID cookie when migrating a matching legacy cookie', () => {
    const legacyAnonymousId = 'legacy-anonymous-id'
    localStorage.setItem(ANONYMOUS_ID_KEY, legacyAnonymousId)
    setCookie(ANONYMOUS_ID_COOKIE_LEGACY, legacyAnonymousId)
    const web = new ContentfulOptimization(config)
    const initializeFromCookieValues: unknown = Reflect.get(web, 'initializeFromCookieValues')

    if (typeof initializeFromCookieValues !== 'function') {
      throw new Error('initializeFromCookieValues is unavailable')
    }

    initializeFromCookieValues.call(web, legacyAnonymousId, legacyAnonymousId)

    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBe(legacyAnonymousId)
    expect(getCookie(ANONYMOUS_ID_COOKIE_LEGACY)).toBeUndefined()
  })

  it('does not load persisted profile continuity when persistence consent is denied', () => {
    localStorage.setItem(PERSISTENCE_CONSENT_KEY, 'denied')
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE))

    const web = new ContentfulOptimization(config)

    expect(web.states.profile.current).toBeUndefined()
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
  })

  it('loads persisted profile continuity from accepted legacy consent', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(DEFAULT_PROFILE))

    const web = new ContentfulOptimization(config)

    expect(web.states.profile.current).toEqual(DEFAULT_PROFILE)
    expect(web.states.persistenceConsent.current).toBe(true)
  })

  it('supports page() without an explicit payload', async () => {
    const web = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await expect(web.page()).resolves.toEqual({
      accepted: true,
      data: EMPTY_OPTIMIZATION_DATA,
    })
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('deduplicates current-page tracking by accepted route key', async () => {
    const web = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await expect(
      web.trackCurrentPage({
        routeKey: '/',
        buildPayload: ({ isInitialEmission }) => ({
          properties: { initial: isInitialEmission },
        }),
      }),
    ).resolves.toEqual({ accepted: true, data: EMPTY_OPTIMIZATION_DATA })
    await expect(
      web.trackCurrentPage({
        routeKey: '/',
        buildPayload: () => ({ properties: { initial: false } }),
      }),
    ).resolves.toEqual({ accepted: false })
    await expect(
      web.trackCurrentPage({
        routeKey: '/products',
        buildPayload: ({ isInitialEmission }) => ({
          properties: { initial: isInitialEmission },
        }),
      }),
    ).resolves.toEqual({ accepted: true, data: EMPTY_OPTIMIZATION_DATA })

    expect(upsertProfile).toHaveBeenCalledTimes(2)
    expect(Reflect.get(upsertProfile.mock.calls[0]?.[0].events[0] ?? {}, 'properties')).toEqual(
      expect.objectContaining({
        initial: true,
      }),
    )
    expect(Reflect.get(upsertProfile.mock.calls[1]?.[0].events[0] ?? {}, 'properties')).toEqual(
      expect.objectContaining({
        initial: false,
      }),
    )
  })

  it('retries current-page tracking when consent was previously blocked', async () => {
    const web = new ContentfulOptimization({ ...config, allowedEventTypes: [] })
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    web.consent(false)
    await expect(
      web.trackCurrentPage({
        routeKey: '/blocked',
        buildPayload: () => ({}),
      }),
    ).resolves.toEqual({ accepted: false })

    web.consent(true)
    await expect(
      web.trackCurrentPage({
        routeKey: '/blocked',
        buildPayload: () => ({}),
      }),
    ).resolves.toEqual({ accepted: true, data: EMPTY_OPTIMIZATION_DATA })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('can mark an SSR-emitted initial current page as accepted', async () => {
    const web = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)

    await expect(
      web.trackCurrentPage({
        initialPageEvent: 'skip',
        routeKey: '/',
        buildPayload: () => ({}),
      }),
    ).resolves.toEqual({ accepted: true })
    await expect(
      web.trackCurrentPage({
        routeKey: '/',
        buildPayload: () => ({}),
      }),
    ).resolves.toEqual({ accepted: false })

    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('can mark an SSR-emitted current page as accepted after another route', async () => {
    const web = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const skippedPayload = rs.fn(() => ({}))
    const dedupedPayload = rs.fn(() => ({}))

    await expect(
      web.trackCurrentPage({
        routeKey: '/',
        buildPayload: () => ({}),
      }),
    ).resolves.toEqual({ accepted: true, data: EMPTY_OPTIMIZATION_DATA })
    await expect(
      web.trackCurrentPage({
        initialPageEvent: 'skip',
        routeKey: '/page-two',
        buildPayload: skippedPayload,
      }),
    ).resolves.toEqual({ accepted: true })
    await expect(
      web.trackCurrentPage({
        routeKey: '/page-two',
        buildPayload: dedupedPayload,
      }),
    ).resolves.toEqual({ accepted: false })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(skippedPayload).not.toHaveBeenCalled()
    expect(dedupedPayload).not.toHaveBeenCalled()
  })

  it('forwards onEventBlocked callback to core stateful guards', async () => {
    const onEventBlocked = rs.fn()
    const web = new ContentfulOptimization({ ...config, onEventBlocked })
    const payload = { event: 'checkout' }

    await web.track(payload)

    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'consent',
        method: 'track',
      }),
    )
  })

  it('uses normal Insights delivery for explicit flushes', async () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, profile: DEFAULT_PROFILE },
    })
    const sendBatchEvents = rs.spyOn(web.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await web.trackClick({ componentId: 'hero-banner' })
    await web.flush()

    expect(sendBatchEvents).toHaveBeenCalledWith(expect.any(Array))
    expect(sendBatchEvents.mock.calls[0]?.[1]).toBeUndefined()
  })

  it('uses Beacon for lifecycle Insights flushes', async () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, profile: DEFAULT_PROFILE },
    })
    const sendBeacon = rs.spyOn(window.navigator, 'sendBeacon').mockReturnValue(true)
    const sendBatchEvents = rs.spyOn(web.api.insights, 'sendBatchEvents').mockResolvedValue(true)

    await web.trackClick({ componentId: 'hero-banner' })
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    await Promise.resolve()

    const beacon = sendBatchEvents.mock.calls[0]?.[1]?.beacon
    expect(typeof beacon).toBe('function')
    expect(beacon?.('/collect', '[]')).toBe(true)
    expect(sendBeacon).toHaveBeenCalledWith('/collect', '[]')
  })

  it('allows creating a new instance after destroy', () => {
    const first = new ContentfulOptimization(config)
    const createSecondOptimization = (): ContentfulOptimization =>
      new ContentfulOptimization(config)

    first.destroy()

    expect(createSecondOptimization).not.toThrow()
  })

  it('clears persisted anonymous ID state when reset() is called', () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, profile: DEFAULT_PROFILE },
    })

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(DEFAULT_PROFILE.id)
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).not.toBeNull()
    expect(document.cookie).toContain(`${ANONYMOUS_ID_COOKIE}=${DEFAULT_PROFILE.id}`)

    web.reset()

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBeNull()
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
    expect(document.cookie).not.toContain(`${ANONYMOUS_ID_COOKIE}=${DEFAULT_PROFILE.id}`)
  })

  it('clears persisted anonymous ID when the profile signal becomes undefined while persistence consent is granted', () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, profile: DEFAULT_PROFILE },
    })

    expect(web.states.profile.current).toEqual(DEFAULT_PROFILE)
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe(DEFAULT_PROFILE.id)

    localStorage.removeItem(ANONYMOUS_ID_KEY)
    signals.profile.value = undefined

    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBeNull()
    expect(document.cookie).not.toContain(`${ANONYMOUS_ID_COOKIE}=${DEFAULT_PROFILE.id}`)
  })
})
