import {
  batch,
  EventBuilder,
  signals,
  type CoreConfig,
  type OptimizationReplayEnvelope,
} from '@contentful/optimization-core'
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
import { EntryInteractionRuntime } from './entry-tracking/EntryInteractionRuntime'
import type { ContentOptimizationHandoff } from './handoff'
import { getCookie, removeCookie, setCookie } from './lib/cookies'
import LocalStore from './storage/LocalStore'
import { deferred } from './test/helpers'
const replayEventBuilder = new EventBuilder({
  channel: 'server',
  library: { name: 'test-server', version: '1.0.0' },
})

const SPACE_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  spaceId: SPACE_ID,
  environment: ENVIRONMENT,
}

function createReplay(routeKey: string): OptimizationReplayEnvelope {
  return {
    experience: [
      replayEventBuilder.buildIdentify({ userId: 'handoff-user' }),
      replayEventBuilder.buildPageView({}),
    ],
    insights: [],
    routeKey,
  }
}

function createContentHandoff(replay?: OptimizationReplayEnvelope): ContentOptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    replay,
  }
}

function compileManagedEntryDescriptorApis(web: ContentfulOptimization): void {
  const descriptor = { contentType: 'page', slug: 'home' } as const

  void web.fetchContentfulEntry(descriptor)
  void web.fetchContentfulEntries([descriptor])
  void web.fetchOptimizedEntry(descriptor)
  void web.prefetchManagedEntries([descriptor])
}

void compileManagedEntryDescriptorApis

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

    expect(web.config.spaceId).toEqual(SPACE_ID)
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

  it('treats the legacy skip input as inert and still deduplicates the same route', async () => {
    const web = new ContentfulOptimization(config)
    const upsertProfile = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const legacyPayload = rs.fn(() => ({ properties: { legacy: true } }))
    const deduplicatedPayload = rs.fn(() => ({}))

    await expect(
      web.trackCurrentPage({
        buildPayload: legacyPayload,
        initialPageEvent: 'skip',
        routeKey: '/',
      }),
    ).resolves.toEqual({ accepted: true, data: EMPTY_OPTIMIZATION_DATA })
    await expect(
      web.trackCurrentPage({
        routeKey: '/',
        buildPayload: deduplicatedPayload,
      }),
    ).resolves.toEqual({ accepted: false })

    expect(upsertProfile).toHaveBeenCalledTimes(1)
    expect(legacyPayload).toHaveBeenCalledTimes(1)
    expect(deduplicatedPayload).not.toHaveBeenCalled()
  })

  it('shares one matching operation and suppresses ordinary concurrent and later pages', async () => {
    const web = new ContentfulOptimization(config)
    const response = Promise.withResolvers<OptimizationData>()
    const upsert = rs.spyOn(web.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const handoff = createContentHandoff(createReplay('/replay'))
    const payload = rs.fn(() => ({ properties: { fallback: true } }))
    const first = web.hydrateAndTrackCurrentPage(handoff, {
      routeKey: '/replay',
      buildPayload: payload,
    })
    const duplicate = web.hydrateAndTrackCurrentPage(handoff, { routeKey: '/replay' })
    const concurrentPage = web.trackCurrentPage({ routeKey: '/replay' })
    response.resolve(EMPTY_OPTIMIZATION_DATA)
    await expect(concurrentPage).resolves.toEqual({ accepted: false })
    await duplicate
    await expect(first).resolves.toMatchObject({ accepted: true })
    await expect(web.trackCurrentPage({ routeKey: '/replay' })).resolves.toEqual({
      accepted: false,
    })
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0]?.[0].events.map((event) => event.type)).toEqual([
      'identify',
      'page',
    ])
    expect(payload).not.toHaveBeenCalled()
  })

  it('rejects unsafe replay before applying state or emitting', async () => {
    const web = new ContentfulOptimization(config)
    const upsert = rs.spyOn(web.api.experience, 'upsertProfile')
    await expect(
      web.hydrateAndTrackCurrentPage(
        { cache: { scope: 'static' }, hydration: 'preserve-server', replay: createReplay('/a') },
        { routeKey: '/a' },
      ),
    ).rejects.toThrow('must not be included in public or static caches')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('publishes state readiness without persisting preview before live completion', async () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
    })
    const response = Promise.withResolvers<OptimizationData>()
    rs.spyOn(web.api.experience, 'upsertProfile').mockReturnValue(response.promise)
    const ready = Promise.withResolvers<undefined>()
    const operation = web.hydrateAndTrackCurrentPage(
      { ...createContentHandoff(createReplay('/a')), state: EMPTY_OPTIMIZATION_DATA },
      {
        routeKey: '/a',
        onHydrated: () => {
          ready.resolve(undefined)
        },
      },
    )
    await ready.promise
    expect(web.states.profile.current).toEqual(EMPTY_OPTIMIZATION_DATA.profile)
    expect(LocalStore.profile).toBeUndefined()
    expect(getCookie(ANONYMOUS_ID_COOKIE)).toBeUndefined()
    response.resolve(EMPTY_OPTIMIZATION_DATA)
    await operation
    expect(LocalStore.profile).toEqual(EMPTY_OPTIMIZATION_DATA.profile)
    expect(LocalStore.anonymousId).toBe(EMPTY_OPTIMIZATION_DATA.profile.id)
  })

  it('continues replay after a recoverable hydration failure', async () => {
    const web = new ContentfulOptimization(config)
    const error = new Error('state apply failed')
    let initial = true
    web.interceptors.state.add((state) => {
      if (initial) {
        initial = false
        throw error
      }
      return state
    })
    const onError = rs.fn()
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    await expect(
      web.hydrateAndTrackCurrentPage(
        { ...createContentHandoff(createReplay('/a')), state: { profile: DEFAULT_PROFILE } },
        { routeKey: '/a', onHydrated: onError },
      ),
    ).resolves.toMatchObject({ accepted: true })
    expect(onError).toHaveBeenCalledWith(error)
    expect(upsert.mock.calls[0]?.[0].events.map((event) => event.type)).toEqual([
      'identify',
      'page',
    ])
  })

  it('does not cancel an older event journal when a newer handoff arrives', async () => {
    const web = new ContentfulOptimization(config)
    const hydration = deferred()
    let firstState = true
    web.interceptors.state.add(async (state) => {
      if (firstState) {
        firstState = false
        await hydration.promise
      }
      return state
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const first = web.hydrateAndTrackCurrentPage(
      {
        ...createContentHandoff({
          experience: [
            replayEventBuilder.buildIdentify({ userId: 'first' }),
            replayEventBuilder.buildPageView({}),
          ],
          insights: [],
          routeKey: '/a',
        }),
        state: { profile: DEFAULT_PROFILE },
      },
      { routeKey: '/a' },
    )
    await web.hydrateAndTrackCurrentPage(
      createContentHandoff({
        experience: [
          replayEventBuilder.buildIdentify({ userId: 'second' }),
          replayEventBuilder.buildPageView({}),
        ],
        insights: [],
        routeKey: '/a',
      }),
      { routeKey: '/a' },
    )
    hydration.resolve()
    await first
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(
      upsert.mock.calls.map(([payload]) => String(Reflect.get(payload.events[0] ?? {}, 'userId'))),
    ).toEqual(['second', 'first'])
  })

  it('keeps an admitted journal when routing changes during hydration', async () => {
    const web = new ContentfulOptimization(config)
    const hydration = deferred()
    let initial = true
    web.interceptors.state.add(async (state) => {
      if (initial) {
        initial = false
        await hydration.promise
      }
      return state
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    let routeKey = '/server'
    const before = rs.fn(async () => {
      await Promise.resolve()
    })
    const operation = web.hydrateAndTrackCurrentPage(
      { ...createContentHandoff(createReplay('/server')), state: { profile: DEFAULT_PROFILE } },
      {
        routeKey,
        getCurrentPage: () => ({
          routeKey,
          buildPayload: () => ({ properties: { path: routeKey } }),
        }),
        beforeInitialPage: before,
      },
    )
    routeKey = '/browser'
    hydration.resolve()
    await operation
    expect(before).not.toHaveBeenCalled()
    expect(upsert.mock.calls[0]?.[0].events.map((event) => event.type)).toEqual([
      'identify',
      'page',
    ])
  })

  it('uses current router inputs for fallback after a mismatch at admission', async () => {
    const web = new ContentfulOptimization(config)
    const hydration = deferred()
    let initial = true
    web.interceptors.state.add(async (state) => {
      if (initial) {
        initial = false
        await hydration.promise
      }
      return state
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    let routeKey = '/browser-a'
    const operation = web.hydrateAndTrackCurrentPage(
      { ...createContentHandoff(createReplay('/server')), state: { profile: DEFAULT_PROFILE } },
      {
        routeKey,
        getCurrentPage: () => ({
          routeKey,
          buildPayload: () => ({ properties: { path: routeKey } }),
        }),
      },
    )
    routeKey = '/browser-b'
    hydration.resolve()
    await expect(operation).resolves.toMatchObject({ accepted: true })
    expect(upsert.mock.calls[0]?.[0].events.map((event) => event.type)).toEqual(['page'])
    expect(Reflect.get(upsert.mock.calls[0]?.[0].events[0] ?? {}, 'properties')).toMatchObject({
      path: '/browser-b',
    })
  })

  it('does not let an older accepted replay replace the newer route deduplication', async () => {
    const web = new ContentfulOptimization(config)
    const older = deferred()
    let initial = true
    web.interceptors.state.add(async (state) => {
      if (initial) {
        initial = false
        await older.promise
      }
      return state
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const first = web.hydrateAndTrackCurrentPage(
      { ...createContentHandoff(createReplay('/older')), state: { profile: DEFAULT_PROFILE } },
      { routeKey: '/older' },
    )
    await web.hydrateAndTrackCurrentPage(createContentHandoff(createReplay('/newer')), {
      routeKey: '/newer',
    })
    older.resolve()
    await first
    await web.trackCurrentPage({ routeKey: '/newer' })
    expect(upsert).toHaveBeenCalledTimes(2)
  })

  it('makes an ordinary page attempt for malformed private replay instructions', async () => {
    const web = new ContentfulOptimization(config)
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const handoff: unknown = {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      replay: { routeKey: '/a', experience: null, insights: [] },
    }
    const operation: unknown = Reflect.apply(web.hydrateAndTrackCurrentPage, web, [
      handoff,
      { routeKey: '/a' },
    ])
    await expect(operation).resolves.toMatchObject({ accepted: true })
    expect(upsert.mock.calls[0]?.[0].events.map((event) => event.type)).toEqual(['page'])
  })

  it('keeps an Analytics-only handoff identity for the ordinary page and later live continuity', async () => {
    const web = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    await web.hydrateAndTrackCurrentPage(
      createContentHandoff({
        profile: { id: 'request-profile' },
        experience: [],
        insights: [replayEventBuilder.buildClick({ componentId: 'entry' })],
      }),
      { routeKey: '/a' },
    )
    expect(upsert.mock.calls[0]?.[0].profileId).toBe('request-profile')
    await web.trackCurrentPage({ routeKey: '/later' })
    expect(upsert.mock.calls[1]?.[0].profileId).toBe(EMPTY_OPTIMIZATION_DATA.profile.id)
  })

  it('falls back once after replay failure', async () => {
    const web = new ContentfulOptimization(config)
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(EMPTY_OPTIMIZATION_DATA)
    await expect(
      web.hydrateAndTrackCurrentPage(createContentHandoff(createReplay('/a')), { routeKey: '/a' }),
    ).resolves.toMatchObject({ accepted: true })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[1]?.[0].events.map((event) => event.type)).toEqual(['page'])
  })

  it('preserves page acceptance after a later malformed Analytics command', async () => {
    const web = new ContentfulOptimization({ ...config, defaults: { consent: true } })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    const handoff = createContentHandoff({
      routeKey: '/a',
      experience: [replayEventBuilder.buildPageView({})],
      insights: [replayEventBuilder.buildClick({ componentId: 'entry' })],
    })
    web.interceptors.event.add((event) => {
      if (event.type === 'component_click') throw new Error('analytics failed')
      return event
    })
    await expect(
      web.hydrateAndTrackCurrentPage(handoff, { routeKey: '/a' }),
    ).resolves.toMatchObject({ accepted: true })
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('accepts offline replay once without persisting preview continuity', async () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, persistenceConsent: true },
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockResolvedValue(EMPTY_OPTIMIZATION_DATA)
    signals.online.value = false
    const handoff = { ...createContentHandoff(createReplay('/a')), state: EMPTY_OPTIMIZATION_DATA }
    await expect(web.hydrateAndTrackCurrentPage(handoff, { routeKey: '/a' })).resolves.toEqual({
      accepted: true,
    })
    await expect(web.trackCurrentPage({ routeKey: '/a' })).resolves.toEqual({ accepted: false })
    expect(upsert).not.toHaveBeenCalled()
    expect(LocalStore.profile).toBeUndefined()
    signals.online.value = true
    await web.flush()
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it.each(['reset', 'destroy'] as const)(
    'does not start canceled initial delivery after %s',
    async (lifecycle) => {
      const web = new ContentfulOptimization(config)
      const hydration = deferred()
      web.interceptors.state.add(async (state) => {
        await hydration.promise
        return state
      })
      const upsert = rs.spyOn(web.api.experience, 'upsertProfile')
      const operation = web.hydrateAndTrackCurrentPage(
        { ...createContentHandoff(createReplay('/a')), state: { profile: DEFAULT_PROFILE } },
        { routeKey: '/a' },
      )
      web[lifecycle]()
      hydration.resolve()
      await expect(operation).resolves.toEqual({ accepted: false })
      expect(upsert).not.toHaveBeenCalled()
    },
  )

  it.each(['reset', 'destroy'] as const)(
    'does not start replay when state readiness tears down the runtime with %s',
    async (lifecycle) => {
      const web = new ContentfulOptimization(config)
      const upsert = rs.spyOn(web.api.experience, 'upsertProfile')
      await expect(
        web.hydrateAndTrackCurrentPage(createContentHandoff(createReplay('/a')), {
          routeKey: '/a',
          onHydrated: () => {
            web[lifecycle]()
          },
        }),
      ).resolves.toEqual({ accepted: false })
      expect(upsert).not.toHaveBeenCalled()
    },
  )

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
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    const beacon = sendBatchEvents.mock.calls[0]?.[1]?.beacon
    expect(typeof beacon).toBe('function')
    expect(beacon?.('/collect', '[]')).toBe(true)
    expect(sendBeacon).toHaveBeenCalledWith('/collect', '[]')
  })

  it('awaits active entry interaction endings before the lifecycle Insights flush', async () => {
    const web = new ContentfulOptimization({
      ...config,
      defaults: { consent: true, profile: DEFAULT_PROFILE },
    })

    const runtime: unknown = Reflect.get(web, 'entryInteractionRuntime')
    if (!(runtime instanceof EntryInteractionRuntime)) {
      throw new Error('entryInteractionRuntime is unavailable')
    }

    const invocations: string[] = []
    const ending = deferred()
    const endActiveInteractions = rs
      .spyOn(runtime, 'endActiveInteractions')
      .mockImplementation(async () => {
        invocations.push('endActiveInteractions:start')
        await ending.promise
        invocations.push('endActiveInteractions:end')
      })
    const sendBatchEvents = rs
      .spyOn(web.api.insights, 'sendBatchEvents')
      .mockImplementation(async () => {
        invocations.push('sendBatchEvents')
        await Promise.resolve()
        return true
      })

    await web.trackClick({ componentId: 'hero-banner' })
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    await Promise.resolve()

    expect(endActiveInteractions).toHaveBeenCalledTimes(1)
    expect(sendBatchEvents).not.toHaveBeenCalled()

    ending.resolve(undefined)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
    expect(invocations).toEqual([
      'endActiveInteractions:start',
      'endActiveInteractions:end',
      'sendBatchEvents',
    ])
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
