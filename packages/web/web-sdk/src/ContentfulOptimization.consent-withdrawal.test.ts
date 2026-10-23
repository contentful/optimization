import { signals, type Subscription } from '@contentful/optimization-core'
import { CONSENT_KEY, PERSISTENCE_CONSENT_KEY } from '@contentful/optimization-core/constants'
import ContentfulOptimization from './ContentfulOptimization'
import * as cookies from './lib/cookies'

describe('Web consent withdrawal ordering', () => {
  let web: ContentfulOptimization | undefined
  let subscription: Subscription | undefined

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    subscription?.unsubscribe()
    web?.destroy()
    rs.restoreAllMocks()
  })

  it('persists explicit decisions before a subscriber can dispose persistence effects', () => {
    web = new ContentfulOptimization({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true },
      autoTrackEntryInteraction: { clicks: false, hovers: false, views: false },
    })
    subscription = web.states.consent.subscribe((value) => {
      if (value === false) web?.destroy()
    })
    web.consent(false)
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied')
    expect(localStorage.getItem(PERSISTENCE_CONSENT_KEY)).toBe('denied')
  })

  it('discards queued events even when cookie deletion fails', async () => {
    web = new ContentfulOptimization({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true },
      autoTrackEntryInteraction: { clicks: false, hovers: false, views: false },
    })
    const upsert = rs
      .spyOn(web.api.experience, 'upsertProfile')
      .mockRejectedValue(new Error('Unexpected transport attempt'))
    signals.online.value = false
    await web.page()
    const remove = rs.spyOn(cookies, 'removeCookie').mockImplementation(() => {
      throw new Error('Cookie access denied')
    })
    expect(() => web?.consent(false)).toThrow('Cookie access denied')
    remove.mockRestore()
    signals.online.value = true
    await web.flush()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('can admit the current route again after its queued page was discarded', async () => {
    web = new ContentfulOptimization({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: true },
      autoTrackEntryInteraction: { clicks: false, hovers: false, views: false },
    })
    signals.online.value = false
    const options = { routeKey: '/current', buildPayload: () => ({}) }
    expect(await web.trackCurrentPage(options)).toEqual({ accepted: true })
    web.consent({ events: false })
    web.consent({ events: true })
    expect(await web.trackCurrentPage(options)).toEqual({ accepted: true })
    web.consent(false)
  })
})
