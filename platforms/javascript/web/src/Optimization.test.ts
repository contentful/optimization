import type { CoreConfig, TrackBuilderArgs } from '@contentful/optimization-core'
import Optimization from './Optimization'
import { OPTIMIZATION_WEB_SDK_NAME } from './global-constants'

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const getAutoTrackEntryViews = (optimization: Optimization): boolean | undefined => {
  const value = Reflect.get(optimization, 'autoTrackEntryViews')

  return typeof value === 'boolean' ? value : undefined
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

  it('defaults autoTrackEntryViews to false when omitted', () => {
    const web = new Optimization(config)

    expect(getAutoTrackEntryViews(web)).toBe(false)
  })

  it('uses autoTrackEntryViews=true when configured', () => {
    const web = new Optimization({ ...config, autoTrackEntryViews: true })

    expect(getAutoTrackEntryViews(web)).toBe(true)
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
