import type { ExperienceRequestState } from '@contentful/optimization-web/core-sdk'
import { rs } from '@rstest/core'
import { act, StrictMode } from 'react'
import { OptimizationContext } from '../context/OptimizationContext'
import {
  OptimizationRouteTransitionContext,
  type RouteSettlement,
} from '../context/OptimizationRouteTransitionContext'
import {
  createMutableCloningObservable,
  createOptimizationSdk,
  renderWithOptimizationProviders,
} from '../test/sdkTestUtils'
import type { AutoPagePayload } from './types'
import { useAutoPageEmitter, type InitialAutoPageEvent } from './useAutoPageEmitter'

function TestAutoPageEmitter({
  enabled = true,
  initialPageEvent,
  routeKey,
  payload,
  buildPayload,
}: {
  enabled?: boolean
  initialPageEvent?: InitialAutoPageEvent
  routeKey: string
  payload?: AutoPagePayload
  buildPayload?: (metadata: { isInitialEmission: boolean }) => AutoPagePayload
}): null {
  useAutoPageEmitter({
    enabled,
    initialPageEvent,
    routeKey,
    buildPayload: buildPayload ?? ((): AutoPagePayload => payload ?? {}),
  })

  return null
}

function TestSkipOnlyAutoPageEmitter({ routeKey }: { routeKey: string }): null {
  useAutoPageEmitter({
    enabled: true,
    initialPageEvent: 'skip',
    routeKey,
  })

  return null
}

describe('useAutoPageEmitter', () => {
  it('emits on first eligible render', async () => {
    const page = rs.fn(async (_payload?: AutoPagePayload) => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" />,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('emits on route changes', async () => {
    const page = rs.fn(async (_payload?: AutoPagePayload) => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const first = await renderWithOptimizationProviders(<TestAutoPageEmitter routeKey="/" />, sdk)

    await first.unmount()

    const second = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/products" />,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(2)

    await second.unmount()
  })

  it('deduplicates identical consecutive route keys', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const first = await renderWithOptimizationProviders(<TestAutoPageEmitter routeKey="/" />, sdk)

    await first.unmount()

    const second = await renderWithOptimizationProviders(<TestAutoPageEmitter routeKey="/" />, sdk)

    expect(page).toHaveBeenCalledTimes(1)

    await second.unmount()
  })

  it('suppresses StrictMode double invocation for the same route key', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <StrictMode>
        <TestAutoPageEmitter routeKey="/" />
      </StrictMode>,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('passes the finished payload through to sdk.page', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter
        routeKey="/checkout"
        payload={{ locale: 'en-US', properties: { source: 'test', path: '/checkout' } }}
      />,
      sdk,
    )

    expect(page).toHaveBeenCalledWith({
      locale: 'en-US',
      properties: { source: 'test', path: '/checkout' },
    })

    await rendered.unmount()
  })

  it('signals isInitialEmission to buildPayload on the first emission only', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const buildPayload = rs.fn(
      ({ isInitialEmission }: { isInitialEmission: boolean }): AutoPagePayload => ({
        properties: { initial: isInitialEmission ? 'yes' : 'no' },
      }),
    )

    const first = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" buildPayload={buildPayload} />,
      sdk,
    )

    await first.unmount()

    const second = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/products" buildPayload={buildPayload} />,
      sdk,
    )

    expect(page).toHaveBeenNthCalledWith(1, { properties: { initial: 'yes' } })
    expect(page).toHaveBeenNthCalledWith(2, { properties: { initial: 'no' } })

    await second.unmount()
  })

  it('does not call buildPayload when deduplicated', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const buildPayload = rs.fn((): AutoPagePayload => ({}))

    const first = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" buildPayload={buildPayload} />,
      sdk,
    )

    await first.unmount()

    const second = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" buildPayload={buildPayload} />,
      sdk,
    )

    expect(buildPayload).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledTimes(1)

    await second.unmount()
  })

  it('skips only the initial route when server rendering already emitted its page event', async () => {
    const page = rs.fn(async (_payload?: AutoPagePayload) => {
      await Promise.resolve()
      return undefined
    })
    const buildPayload = rs.fn((): AutoPagePayload => ({}))
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter initialPageEvent="skip" routeKey="/" buildPayload={buildPayload} />,
      sdk,
    )

    expect(buildPayload).not.toHaveBeenCalled()
    expect(page).not.toHaveBeenCalled()

    await rendered.rerender(
      <TestAutoPageEmitter
        initialPageEvent="skip"
        routeKey="/products"
        buildPayload={buildPayload}
      />,
    )

    expect(buildPayload).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledTimes(1)

    await rendered.rerender(
      <TestAutoPageEmitter initialPageEvent="skip" routeKey="/" buildPayload={buildPayload} />,
    )

    expect(buildPayload).toHaveBeenCalledTimes(2)
    expect(page).toHaveBeenCalledTimes(2)

    await rendered.unmount()
  })

  it('marks a skipped initial route without a payload builder', async () => {
    const settleRoute = rs.fn((_routeKey: string, _settlement: RouteSettlement): void => undefined)
    const trackCurrentPage = rs.fn(async () => {
      await Promise.resolve()
      return { accepted: true as const }
    })
    const sdk = createOptimizationSdk({ trackCurrentPage })
    const rendered = await renderWithOptimizationProviders(
      <OptimizationRouteTransitionContext.Provider
        value={{
          isHandoffPending: false,
          isLiveRuntimeAuthoritative: false,
          isPresentationLive: false,
          presentationSdk: undefined,
          settleRoute,
          startRoute: () => undefined,
        }}
      >
        <TestSkipOnlyAutoPageEmitter routeKey="/" />
      </OptimizationRouteTransitionContext.Provider>,
      sdk,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      initialPageEvent: 'skip',
      routeKey: '/',
    })
    expect(settleRoute).toHaveBeenCalledWith('/', 'satisfied')

    await rendered.unmount()
  })

  it('settles an already-accepted route without claiming a new response', async () => {
    const settleRoute = rs.fn((_routeKey: string, _settlement: RouteSettlement): void => undefined)
    const trackCurrentPage = rs.fn(
      async () =>
        await Promise.resolve({ accepted: false as const, reason: 'already-accepted' as const }),
    )
    const sdk = createOptimizationSdk({ trackCurrentPage })
    const rendered = await renderWithOptimizationProviders(
      <OptimizationRouteTransitionContext.Provider
        value={{
          isHandoffPending: false,
          isLiveRuntimeAuthoritative: false,
          isPresentationLive: false,
          presentationSdk: undefined,
          settleRoute,
          startRoute: () => undefined,
        }}
      >
        <TestAutoPageEmitter routeKey="/accepted" />
      </OptimizationRouteTransitionContext.Provider>,
      sdk,
    )

    expect(settleRoute).toHaveBeenCalledWith('/accepted', 'satisfied')

    await rendered.unmount()
  })

  it('does not emit when disabled', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter enabled={false} routeKey="/" />,
      sdk,
    )

    expect(page).not.toHaveBeenCalled()

    await rendered.unmount()
  })

  it('keeps an emitted handoff route pending until the provider SDK becomes live and responds', async () => {
    const startRoute = rs.fn((_routeKey: string): void => undefined)
    const settleRoute = rs.fn((_routeKey: string, _settlement: RouteSettlement): void => undefined)
    const routeTransition = {
      isHandoffPending: false,
      isLiveRuntimeAuthoritative: false,
      isPresentationLive: false,
      presentationSdk: undefined,
      settleRoute,
      startRoute,
    }
    const snapshotTrackCurrentPage = rs.fn(
      async () =>
        await Promise.resolve({ accepted: false as const, reason: 'not-allowed' as const }),
    )
    const snapshotSdk = createOptimizationSdk({ trackCurrentPage: snapshotTrackCurrentPage })
    const livePageRequest = Promise.withResolvers<{ readonly accepted: true }>()
    const liveRequestState = createMutableCloningObservable<ExperienceRequestState>({
      status: 'pending',
    })
    const buildPayload = rs.fn((): AutoPagePayload => ({}))
    const liveTrackCurrentPage = rs.fn(async () => await livePageRequest.promise)
    const liveSdk = createOptimizationSdk({
      states: { experienceRequestState: liveRequestState.observable },
      trackCurrentPage: liveTrackCurrentPage,
    })
    const rendered = await renderWithOptimizationProviders(
      <OptimizationContext.Provider value={{ error: undefined, isLive: false, sdk: snapshotSdk }}>
        <OptimizationRouteTransitionContext.Provider value={routeTransition}>
          <TestAutoPageEmitter
            buildPayload={buildPayload}
            initialPageEvent="emit"
            routeKey="/handoff"
          />
        </OptimizationRouteTransitionContext.Provider>
      </OptimizationContext.Provider>,
      snapshotSdk,
    )

    expect(startRoute).toHaveBeenCalledWith('/handoff')
    expect(snapshotTrackCurrentPage).not.toHaveBeenCalled()
    expect(settleRoute).not.toHaveBeenCalled()

    await rendered.rerender(
      <OptimizationContext.Provider value={{ error: undefined, isLive: true, sdk: liveSdk }}>
        <OptimizationRouteTransitionContext.Provider value={routeTransition}>
          <TestAutoPageEmitter
            buildPayload={buildPayload}
            initialPageEvent="emit"
            routeKey="/handoff"
          />
        </OptimizationRouteTransitionContext.Provider>
      </OptimizationContext.Provider>,
    )

    expect(liveTrackCurrentPage).toHaveBeenCalledTimes(1)
    expect(settleRoute).not.toHaveBeenCalled()

    await liveRequestState.emit({ status: 'success' })
    await act(async () => {
      livePageRequest.resolve({ accepted: true })
      await livePageRequest.promise
      await Promise.resolve()
    })

    expect(settleRoute).toHaveBeenCalledWith('/handoff', 'satisfied-with-response')

    await rendered.unmount()
  })

  it('waits for a newer ordinary Experience request after the page request is accepted', async () => {
    const requestState = createMutableCloningObservable<ExperienceRequestState>({
      status: 'pending',
    })
    const pageRequest = Promise.withResolvers<undefined>()
    const pageStarted = Promise.withResolvers<undefined>()
    const ordinaryRequest = Promise.withResolvers<undefined>()
    const ordinaryStarted = Promise.withResolvers<undefined>()
    const settleRoute = rs.fn((_routeKey: string, _settlement: RouteSettlement): void => undefined)
    const buildPayload = rs.fn((): AutoPagePayload => ({}))
    const trackCurrentPage = rs.fn(async () => {
      pageStarted.resolve(undefined)
      await pageRequest.promise
      return { accepted: true as const }
    })
    const sdk = createOptimizationSdk({
      identify: async () => {
        ordinaryStarted.resolve(undefined)
        await ordinaryRequest.promise
        await requestState.emit({ status: 'success' })
        return { accepted: true }
      },
      states: { experienceRequestState: requestState.observable },
      trackCurrentPage,
    })
    const rendered = await renderWithOptimizationProviders(
      <OptimizationRouteTransitionContext.Provider
        value={{
          isHandoffPending: false,
          isLiveRuntimeAuthoritative: false,
          isPresentationLive: false,
          presentationSdk: undefined,
          settleRoute,
          startRoute: () => undefined,
        }}
      >
        <TestAutoPageEmitter buildPayload={buildPayload} routeKey="/products" />
      </OptimizationRouteTransitionContext.Provider>,
      sdk,
    )

    await pageStarted.promise
    const identifyRequest = sdk.identify({ userId: 'later-user' })
    await ordinaryStarted.promise

    await act(async () => {
      pageRequest.resolve(undefined)
      await pageRequest.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(settleRoute).not.toHaveBeenCalled()

    ordinaryRequest.resolve(undefined)
    await identifyRequest
    await act(async () => {
      await Promise.resolve()
    })

    expect(settleRoute).toHaveBeenCalledWith('/products', 'satisfied-with-response')
    expect(trackCurrentPage).toHaveBeenCalledTimes(1)

    await rendered.unmount()
  })

  it('skips sdk calls while page tracking is not allowed and emits the current route once allowed', async () => {
    let pageTrackingAllowed = false
    const consent = createMutableCloningObservable<boolean | undefined>(undefined)
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({
      hasConsent: () => pageTrackingAllowed,
      page,
      states: {
        consent: consent.observable,
      },
    })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/blocked" />,
      sdk,
    )

    expect(page).not.toHaveBeenCalled()

    pageTrackingAllowed = true
    await consent.emit(true)

    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith({})

    await rendered.unmount()
  })
})
