import { CoreStateful, signalFns } from '@contentful/optimization-core'
import { PreviewOverrideManager } from '@contentful/optimization-core/preview-support'
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

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let deferredResolve: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    deferredResolve = resolve
  })

  return {
    promise,
    resolve: (value) => {
      deferredResolve?.(value)
    },
  }
}

const trackCurrentScreen = async (
  payload: Parameters<typeof bridge.trackCurrentScreen>[0],
): Promise<unknown> =>
  await new Promise<unknown>((resolve, reject) => {
    bridge.trackCurrentScreen(
      payload,
      (json) => {
        const result: unknown = JSON.parse(json)
        resolve(result)
      },
      (error) => {
        reject(new Error(error))
      },
    )
  })

const PROFILE_RESPONSE = {
  data: {
    changes: [],
    experiences: [],
    profile: {
      audiences: [],
      id: 'profile-after-reset',
      location: {},
      random: 0,
      session: {
        activeSessionLength: 0,
        averageSessionLength: 0,
        count: 1,
        id: 'session-after-reset',
        isReturningVisitor: false,
        landingPage: {
          path: '',
          query: {},
          referrer: '',
          search: '',
          url: '',
        },
      },
      stableId: 'profile-after-reset',
      traits: {},
    },
  },
  error: null,
  message: 'ok',
}

describe('bridge contract', () => {
  afterEach(() => {
    bridge.destroy()
    rs.restoreAllMocks()
    rs.unstubAllGlobals()
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

  it('clears the bridge anonymous ID when reset is called', async () => {
    const fetchMock = rs.fn<typeof fetch>(
      async () => new Response(JSON.stringify(PROFILE_RESPONSE)),
    )
    rs.stubGlobal('fetch', fetchMock)
    bridge.initialize({
      clientId: 'test-client',
      environment: 'main',
      defaults: {
        anonymousId: 'bridge-anonymous-id',
        consent: true,
        persistenceConsent: true,
      },
    })
    bridge.reset()

    await new Promise<void>((resolve, reject) => {
      bridge.page(
        {},
        () => {
          resolve()
        },
        (error) => {
          reject(new Error(error))
        },
      )
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/profiles$/)
  })

  it('rolls back acquired resources when bridge effect construction fails', () => {
    const originalEffect = signalFns.effect
    const onStateChange = rs.fn()
    const disposeStateEffect = rs.fn()
    const destroyCore = rs.spyOn(CoreStateful.prototype, 'destroy')
    const destroyOverrideManager = rs.spyOn(PreviewOverrideManager.prototype, 'destroy')
    let stateEffectCreated = false
    rs.stubGlobal('__nativeOnStateChange', onStateChange)
    const effectSpy = rs.spyOn(signalFns, 'effect').mockImplementation((callback) => {
      if (stateEffectCreated) throw new Error('Bridge effect initialization failed')

      const dispose = originalEffect(callback)
      if (onStateChange.mock.calls.length === 0) return dispose

      stateEffectCreated = true

      return () => {
        disposeStateEffect()
        dispose()
      }
    })

    expect(() => {
      initializeBridge()
    }).toThrowError('Bridge effect initialization failed')
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(destroyOverrideManager).toHaveBeenCalledTimes(1)
    expect(disposeStateEffect).toHaveBeenCalledTimes(1)
    expect(destroyCore).toHaveBeenCalledTimes(1)
    expect(bridge.hasConsent('screen')).toBe(false)

    bridge.destroy()
    expect(destroyOverrideManager).toHaveBeenCalledTimes(1)
    expect(disposeStateEffect).toHaveBeenCalledTimes(1)
    expect(destroyCore).toHaveBeenCalledTimes(1)

    effectSpy.mockRestore()
    expect(() => {
      initializeBridge()
    }).not.toThrow()
  })

  it('disposes a successful bridge runtime exactly once', () => {
    const destroyCore = rs.spyOn(CoreStateful.prototype, 'destroy')
    const destroyOverrideManager = rs.spyOn(PreviewOverrideManager.prototype, 'destroy')

    initializeBridge()
    bridge.destroy()
    bridge.destroy()

    expect(destroyOverrideManager).toHaveBeenCalledTimes(1)
    expect(destroyCore).toHaveBeenCalledTimes(1)
  })

  it('keeps joined and deduplicated current-screen callback payloads compatible', async () => {
    const response = createDeferred<void>()
    const fetchMock = rs.fn<typeof fetch>(async () => {
      await response.promise
      return new Response(JSON.stringify(PROFILE_RESPONSE))
    })
    rs.stubGlobal('fetch', fetchMock)
    bridge.initialize({
      clientId: 'test-client',
      environment: 'main',
      defaults: { consent: true },
    })

    const first = trackCurrentScreen({ name: 'Home' })
    const joined = trackCurrentScreen({ name: 'Home' })
    response.resolve(undefined)

    const firstResult = await first
    const joinedResult = await joined
    const deduplicatedResult = await trackCurrentScreen({ name: 'Home' })

    expect(firstResult).toEqual(expect.objectContaining({ accepted: true }))
    expect(joinedResult).toEqual(firstResult)
    expect(firstResult).not.toHaveProperty('status')
    expect(deduplicatedResult).toEqual({ accepted: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('requires native callers to retry the current screen explicitly after reconnecting', async () => {
    const fetchMock = rs.fn<typeof fetch>(
      async () => new Response(JSON.stringify(PROFILE_RESPONSE)),
    )
    rs.stubGlobal('fetch', fetchMock)
    bridge.initialize({
      clientId: 'test-client',
      environment: 'main',
      defaults: { consent: true },
    })

    bridge.setOnline(false)
    await expect(trackCurrentScreen({ name: 'Home' })).resolves.toEqual({ accepted: false })
    expect(fetchMock).not.toHaveBeenCalled()

    bridge.setOnline(true)
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(trackCurrentScreen({ name: 'Home' })).resolves.toEqual(
      expect.objectContaining({ accepted: true }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
