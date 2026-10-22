import { batch, signals } from '@contentful/optimization-core'
import { profile } from '../../../universal/core-sdk/src/test/fixtures/profile'
import ContentfulOptimization from './ContentfulOptimization'
import { EntryInteractionRuntime } from './entry-tracking/EntryInteractionRuntime'
import { advance, deferred, installIOPolyfill } from './test/helpers'

const interactions = ['views', 'hovers'] as const

type TimedInteraction = (typeof interactions)[number]

function hover(element: Element): void {
  const event =
    typeof window.PointerEvent === 'function'
      ? new PointerEvent('pointerenter', { pointerType: 'mouse' })
      : new MouseEvent('mouseenter')
  element.dispatchEvent(event)
}

function getInteractionRuntime(web: ContentfulOptimization): EntryInteractionRuntime {
  const runtime = Reflect.get(web, 'entryInteractionRuntime')
  if (!(runtime instanceof EntryInteractionRuntime)) throw new Error('Missing interaction runtime')
  return runtime
}

describe('ContentfulOptimization tracking lifecycle', () => {
  const io = installIOPolyfill()

  const createWeb = (): ContentfulOptimization => {
    const web = new ContentfulOptimization({
      spaceId: 'key_123',
      environment: 'main',
      defaults: { consent: false, persistenceConsent: false, profile },
      allowedEventTypes: ['component', 'component_hover'],
      autoTrackEntryInteraction: { views: true, hovers: true, clicks: false },
    })
    rs.spyOn(web.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    rs.spyOn(web.api.experience, 'upsertProfile').mockResolvedValue({
      profile,
      changes: [],
      selectedOptimizations: [],
    })
    return web
  }

  const startInteraction = async (
    interaction: TimedInteraction,
    element: Element,
  ): Promise<void> => {
    if (interaction === 'hovers') hover(element)
    else io.getLast()?.trigger({ target: element, isIntersecting: true, intersectionRatio: 1 })
    await advance(1000)
  }

  beforeEach(() => {
    rs.useFakeTimers()
    document.body.innerHTML = '<div data-ctfl-entry-id="entry-lifecycle"></div>'
    localStorage.clear()
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
    document.body.innerHTML = ''
    rs.clearAllTimers()
    rs.useRealTimers()
    rs.restoreAllMocks()
  })

  afterAll(() => {
    io.restore()
  })

  it.each(interactions)(
    'discards queued %s callbacks across reset, withdrawal, destroy, and replacement',
    async (interaction) => {
      for (const action of ['reset', 'withdraw', 'destroy', 'replace'] as const) {
        const web = createWeb()
        const first = deferred()
        const track =
          interaction === 'views'
            ? rs.spyOn(web, 'trackView').mockImplementation(async () => {
                await first.promise
                return { accepted: true }
              })
            : rs.spyOn(web, 'trackHover').mockImplementation(async () => {
                await first.promise
              })
        const element = document.querySelector('[data-ctfl-entry-id]')
        if (!element) throw new Error('Missing entry')

        await startInteraction(interaction, element)
        expect(track).toHaveBeenCalledTimes(1)
        const ending = getInteractionRuntime(web).endActiveInteractions()

        if (action === 'reset') web.reset()
        if (action === 'withdraw') web.consent({ events: false })
        if (action === 'destroy' || action === 'replace') web.destroy()
        if (action === 'replace') createWeb()
        first.resolve()
        await ending

        expect(track).toHaveBeenCalledTimes(1)
        web.destroy()
      }
    },
  )

  it.each(interactions)(
    'preserves pending %s drain after a manual stop or persistence-only change',
    async (interaction) => {
      for (const action of ['stop', 'persistence'] as const) {
        const web = createWeb()
        const first = deferred()
        const track =
          interaction === 'views'
            ? rs.spyOn(web, 'trackView').mockImplementation(async () => {
                await first.promise
                return { accepted: true }
              })
            : rs.spyOn(web, 'trackHover').mockImplementation(async () => {
                await first.promise
              })
        const element = document.querySelector('[data-ctfl-entry-id]')
        if (!element) throw new Error('Missing entry')

        await startInteraction(interaction, element)
        const ending = getInteractionRuntime(web).endActiveInteractions()
        if (action === 'stop') web.tracking.disable(interaction)
        else web.consent({ persistence: false })
        first.resolve()
        await ending

        expect(track).toHaveBeenCalledTimes(2)
        web.destroy()
      }
    },
  )

  it('restarts allowlisted views on repeated event withdrawal', async () => {
    const web = createWeb()
    const trackView = rs.spyOn(web, 'trackView').mockResolvedValue({ accepted: true })
    const element = document.querySelector('[data-ctfl-entry-id]')
    if (!element) throw new Error('Missing entry')

    await startInteraction('views', element)
    web.consent({ events: false })
    await startInteraction('views', element)
    web.consent({ events: false })
    await startInteraction('views', element)

    expect(trackView).toHaveBeenCalledTimes(3)
  })

  it('emits sticky again for the same element after reset and a new visitor', async () => {
    const web = createWeb()
    const trackView = rs.spyOn(web, 'trackView').mockResolvedValue({ accepted: true })
    const element = document.querySelector('[data-ctfl-entry-id]')
    if (!(element instanceof HTMLElement)) throw new Error('Missing entry')
    element.dataset.ctflSticky = 'true'

    await startInteraction('views', element)
    await getInteractionRuntime(web).endActiveInteractions()
    expect(trackView).toHaveBeenLastCalledWith(expect.objectContaining({ sticky: undefined }))

    web.reset()
    signals.profile.value = { ...profile, id: 'new-visitor', stableId: 'new-visitor' }
    web.tracking.enable('views')
    await startInteraction('views', element)

    expect(trackView).toHaveBeenLastCalledWith(expect.objectContaining({ sticky: true }))
  })
})
