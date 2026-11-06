import { batch, signals } from '@contentful/optimization-core'
import type { OptimizationData, Profile } from '@contentful/optimization-core/api-schemas'
import ContentfulOptimization from './ContentfulOptimization'
import { ANONYMOUS_ID_COOKIE } from './constants'
import { removeCookie } from './lib/cookies'
import { deferred } from './test/helpers'

const config = {
  spaceId: 'key_123',
  environment: 'main',
  defaults: { consent: true, persistenceConsent: true },
}

function response(id: string, selectionId = id): OptimizationData {
  const profile: Profile = {
    id,
    stableId: id,
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: `${id}-session`,
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
  return {
    profile,
    changes: [],
    selectedOptimizations: [
      { experienceId: selectionId, variantIndex: 1, variants: {}, sticky: false },
    ],
  }
}

describe('Web Experience profile publication', () => {
  beforeEach(() => {
    delete window.contentfulOptimization
    localStorage.clear()
    removeCookie(ANONYMOUS_ID_COOKIE)
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.experienceRequestState.value = { status: 'idle' }
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

  it('publishes an ordinary Experience response when its profile is current', async () => {
    const sdk = new ContentfulOptimization(config)
    const current = response('current')
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(current)

    expect(await sdk.track({ event: 'ordinary' })).toMatchObject({ accepted: true })
    expect(sdk.states.profile.current).toEqual(current.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(current.selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('does not publish a delayed response over a newer ordinary Experience response', async () => {
    const sdk = new ContentfulOptimization(config)
    const oldResponse = deferred<OptimizationData>()
    const oldStarted = deferred()
    const oldData = response('old')
    const newer = response('newer')
    const interceptedProfiles: string[] = []
    sdk.interceptors.state.add((state) => {
      if (state.profile) interceptedProfiles.push(state.profile.id)
      return state
    })
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementationOnce(async () => {
        oldStarted.resolve()
        return await oldResponse.promise
      })
      .mockResolvedValueOnce(newer)

    const old = sdk.track({ event: 'old' })
    await oldStarted.promise
    expect(await sdk.track({ event: 'newer' })).toMatchObject({ accepted: true })
    expect(deliver).toHaveBeenCalledTimes(2)
    expect(sdk.states.profile.current).toEqual(newer.profile)

    oldResponse.resolve(oldData)
    expect(await old).toEqual({ accepted: true, data: oldData })
    expect(interceptedProfiles).toEqual(['newer'])
    expect(sdk.states.profile.current).toEqual(newer.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('keeps newer selections when overlapping responses contain the same profile', async () => {
    const sdk = new ContentfulOptimization(config)
    const oldResponse = deferred<OptimizationData>()
    const oldStarted = deferred()
    const initial = response('shared', 'initial-selection')
    const oldData = response('shared', 'old-selection')
    const newer = response('shared', 'newer-selection')
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(async () => {
        oldStarted.resolve()
        return await oldResponse.promise
      })
      .mockResolvedValueOnce(newer)

    expect(await sdk.track({ event: 'initial' })).toEqual({ accepted: true, data: initial })
    expect(sdk.states.profile.current).toEqual(initial.profile)
    const old = sdk.track({ event: 'old' })
    await oldStarted.promise
    expect(await sdk.track({ event: 'newer' })).toEqual({ accepted: true, data: newer })
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)

    oldResponse.resolve(oldData)
    expect(await old).toEqual({ accepted: true, data: oldData })
    expect(deliver).toHaveBeenCalledTimes(3)
    expect(sdk.states.profile.current).toEqual(newer.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)
  })

  it('suppresses an entire response when newer profile publication wins during a state interceptor', async () => {
    const sdk = new ContentfulOptimization(config)
    const oldStateStarted = deferred()
    const releaseOldState = deferred()
    sdk.interceptors.state.add(async (state) => {
      if (state.profile?.id === 'old') {
        oldStateStarted.resolve()
        await releaseOldState.promise
      }
      return state
    })
    const newer = response('newer')
    const oldData = response('old')
    rs.spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValueOnce(oldData)
      .mockResolvedValueOnce(newer)

    const old = sdk.track({ event: 'old' })
    await oldStateStarted.promise
    expect(await sdk.track({ event: 'newer' })).toMatchObject({ accepted: true })
    expect(sdk.states.profile.current).toEqual(newer.profile)

    releaseOldState.resolve()
    expect(await old).toEqual({ accepted: true, data: oldData })
    expect(sdk.states.profile.current).toEqual(newer.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('does not publish a response whose ordinary event interceptor preceded newer profile publication', async () => {
    const sdk = new ContentfulOptimization(config)
    const oldEventStarted = deferred()
    const releaseOldEvent = deferred()
    let interceptedCount = 0
    sdk.interceptors.event.add(async (event) => {
      interceptedCount += 1
      if (interceptedCount === 1) {
        oldEventStarted.resolve()
        await releaseOldEvent.promise
      }
      return event
    })
    const oldData = response('old')
    const newer = response('newer')
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValueOnce(newer)
      .mockResolvedValueOnce(oldData)

    const old = sdk.track({ event: 'old' })
    await oldEventStarted.promise
    expect(await sdk.track({ event: 'newer' })).toEqual({ accepted: true, data: newer })
    expect(sdk.states.profile.current).toEqual(newer.profile)

    releaseOldEvent.resolve()
    expect(await old).toEqual({ accepted: true, data: oldData })
    expect(deliver).toHaveBeenCalledTimes(2)
    expect(sdk.states.profile.current).toEqual(newer.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)
  })

  it('drains an accepted prepared delivery after a newer ordinary response publishes', async () => {
    const sdk = new ContentfulOptimization(config)
    const preparedResponse = deferred<OptimizationData>()
    const preparedStarted = deferred()
    const newer = response('newer')
    const deliver = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockImplementationOnce(async () => {
        preparedStarted.resolve()
        return await preparedResponse.promise
      })
      .mockResolvedValueOnce(newer)
    const handoff = {
      cache: { scope: 'private-request' as const },
      profileId: 'issued',
      replay: { routeKey: '/prepared', events: [sdk.eventBuilder.buildPageView()] },
    }

    expect(await sdk.hydrateAndTrackCurrentPage(handoff, { routeKey: '/prepared' })).toEqual({
      accepted: true,
    })
    await preparedStarted.promise
    expect(await sdk.track({ event: 'newer' })).toMatchObject({ accepted: true })

    preparedResponse.resolve(response('prepared'))
    await sdk.flush()
    await sdk.flush()
    expect(deliver).toHaveBeenCalledTimes(2)
    expect(sdk.states.profile.current).toEqual(newer.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(newer.selectedOptimizations)
  })
})
