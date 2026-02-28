import type { CoreConfig, TrackBuilderArgs } from '@contentful/optimization-core'
import Optimization from './Optimization'
import { OPTIMIZATION_WEB_SDK_NAME } from './constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

interface AutoTrackState {
  clicks: boolean
  views: boolean
}

function isAutoTrackState(value: unknown): value is AutoTrackState {
  if (!value || typeof value !== 'object') return false

  const clicks = Reflect.get(value, 'clicks')
  const views = Reflect.get(value, 'views')

  return typeof clicks === 'boolean' && typeof views === 'boolean'
}

const getAutoTrackState = (optimization: Optimization): AutoTrackState | undefined => {
  const runtime = Reflect.get(optimization, 'entryInteractionRuntime')
  const value = Reflect.get(runtime, 'autoTrackEntryInteractions')

  return isAutoTrackState(value) ? value : undefined
}

const getAutoTrackEntryViews = (optimization: Optimization): boolean | undefined => {
  const state = getAutoTrackState(optimization)

  return state?.views
}

const getAutoTrackEntryClicks = (optimization: Optimization): boolean | undefined => {
  const state = getAutoTrackState(optimization)

  return state?.clicks
}

const getAllowedEventTypes = (optimization: Optimization): string[] | undefined => {
  const value = Reflect.get(optimization.personalization, 'allowedEventTypes')

  if (!Array.isArray(value)) {
    return
  }

  return value.filter((eventType): eventType is string => typeof eventType === 'string')
}

describe('Optimization', () => {
  beforeEach(() => {
    delete window.optimization
    localStorage.clear()
  })

  afterEach(() => {
    window.optimization?.destroy()
    delete window.optimization
  })

  it('sets configured options', () => {
    const web = new Optimization(config)

    expect(web.config.clientId).toEqual(CLIENT_ID)
    expect(web.eventBuilder.library.name).toEqual(OPTIMIZATION_WEB_SDK_NAME)
  })

  it('defaults autoTrackEntryInteraction.views/clicks to false when omitted', () => {
    const web = new Optimization(config)

    expect(getAutoTrackEntryViews(web)).toBe(false)
    expect(getAutoTrackEntryClicks(web)).toBe(false)
  })

  it('uses autoTrackEntryInteraction.views=true when configured', () => {
    const web = new Optimization({ ...config, autoTrackEntryInteraction: { views: true } })

    expect(getAutoTrackEntryViews(web)).toBe(true)
    expect(getAutoTrackEntryClicks(web)).toBe(false)
  })

  it('uses autoTrackEntryInteraction.clicks=true when configured', () => {
    const web = new Optimization({ ...config, autoTrackEntryInteraction: { clicks: true } })

    expect(getAutoTrackEntryViews(web)).toBe(false)
    expect(getAutoTrackEntryClicks(web)).toBe(true)
  })

  it('supports generic interaction APIs for entry view tracking', () => {
    const web = new Optimization(config)
    const element = document.createElement('div')

    web.tracking.enable('views')
    web.tracking.observe('views', element, { data: { entryId: 'entry-123' } })
    web.tracking.unobserve('views', element)
    web.tracking.disable('views')

    expect(getAutoTrackEntryViews(web)).toBe(true)
  })

  it('supports generic interaction APIs for entry click tracking', () => {
    const web = new Optimization(config)
    const element = document.createElement('div')

    web.tracking.enable('clicks')
    web.tracking.observe('clicks', element, { data: { entryId: 'entry-123' } })
    web.tracking.unobserve('clicks', element)
    web.tracking.disable('clicks')

    expect(getAutoTrackEntryClicks(web)).toBe(true)
  })

  it('defaults allowedEventTypes to identify/page for web', () => {
    const web = new Optimization(config)

    expect(getAllowedEventTypes(web)).toEqual(['identify', 'page'])
  })

  it('uses user-provided allowedEventTypes when configured', () => {
    const web = new Optimization({
      ...config,
      allowedEventTypes: ['identify', 'page', 'screen'],
    })

    expect(getAllowedEventTypes(web)).toEqual(['identify', 'page', 'screen'])
  })

  it('forwards onEventBlocked callback to core stateful guards', async () => {
    const onEventBlocked = rs.fn()
    const web = new Optimization({ ...config, onEventBlocked })
    const payload: TrackBuilderArgs = { event: 'checkout' }

    await web.track(payload)

    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'consent',
        product: 'personalization',
        method: 'track',
      }),
    )
  })

  it('allows creating a new instance after destroy', () => {
    const first = new Optimization(config)
    const createSecondOptimization = (): Optimization => new Optimization(config)

    first.destroy()

    expect(createSecondOptimization).not.toThrow()
  })
})
