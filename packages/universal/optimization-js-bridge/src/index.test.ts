import { afterEach, describe, expect, it, rs } from '@rstest/core'
import bridge from './index'

const initializeBridge = (): void => {
  bridge.initialize({
    clientId: 'test-client',
    environment: 'main',
  })
}

const createCallbacks = (): {
  onError: (error: string) => void
  onSuccess: (json: string) => void
} => ({
  onError: rs.fn(),
  onSuccess: rs.fn(),
})

describe('bridge contract', () => {
  afterEach(() => {
    bridge.destroy()
  })

  it('installs a callable bridge object on globalThis', () => {
    const nativeGlobal = globalThis as typeof globalThis & { __bridge?: unknown }

    expect(nativeGlobal.__bridge).toBe(bridge)
    for (const methodName of Object.keys(bridge)) {
      expect(typeof (bridge as unknown as Record<string, unknown>)[methodName]).toBe('function')
    }
  })

  it('rejects invalid identify payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.identify({ traits: {} } as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('identify payload must include a string "userId".')
  })

  it('rejects invalid page payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.page([] as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('page payload must be an object.')
  })

  it('rejects invalid screen payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.screen({ name: 'Home', properties: [] } as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      'screen payload "properties" must be an object when provided.',
    )
  })

  it('rejects invalid current-screen payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.trackCurrentScreen({ name: 'Home', routeKey: 1 } as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      'trackCurrentScreen payload "routeKey" must be a string when provided.',
    )
  })

  it('rejects invalid custom-event payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.track({ properties: {} } as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('track payload must include a string "event".')
  })

  it('rejects invalid view payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.trackView(
      {
        componentId: 'component-1',
        viewId: 'view-1',
        variantIndex: '0',
        viewDurationMs: 1,
      } as never,
      onSuccess,
      onError,
    )

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('trackView payload must include a number "variantIndex".')
  })

  it('rejects invalid click payloads before calling core', () => {
    initializeBridge()
    const { onError, onSuccess } = createCallbacks()

    bridge.trackClick({ componentId: 1, variantIndex: 0 } as never, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('trackClick payload must include a string "componentId".')
  })

  it('accepts optimizationContextId on native tracking payloads', async () => {
    bridge.initialize({
      clientId: 'test-client',
      environment: 'main',
      allowedEventTypes: ['component', 'component_click'],
      defaults: {
        consent: true,
        profile: {
          audiences: [],
          id: 'profile-1',
          location: {},
          random: 0,
          session: {
            activeSessionLength: 0,
            averageSessionLength: 0,
            count: 1,
            id: 'session-1',
            isReturningVisitor: false,
            landingPage: {
              path: '',
              query: {},
              referrer: '',
              search: '',
              url: '',
            },
          },
          stableId: 'profile-1',
          traits: {},
        },
      },
    })
    const viewCallbacks = createCallbacks()
    const clickCallbacks = createCallbacks()

    bridge.trackView(
      {
        componentId: 'component-1',
        optimizationContextId: 'ctx-1',
        variantIndex: 0,
        viewDurationMs: 1,
        viewId: 'view-1',
      },
      viewCallbacks.onSuccess,
      viewCallbacks.onError,
    )
    bridge.trackClick(
      {
        componentId: 'component-1',
        optimizationContextId: 'ctx-1',
        variantIndex: 0,
      },
      clickCallbacks.onSuccess,
      clickCallbacks.onError,
    )

    await Promise.resolve()

    expect(viewCallbacks.onError).not.toHaveBeenCalled()
    expect(clickCallbacks.onError).not.toHaveBeenCalled()
  })
})
