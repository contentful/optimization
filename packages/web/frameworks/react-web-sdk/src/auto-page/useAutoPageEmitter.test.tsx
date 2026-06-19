import { rs } from '@rstest/core'
import { StrictMode } from 'react'
import {
  createMutableCloningObservable,
  createOptimizationSdk,
  renderWithOptimizationProviders,
} from '../test/sdkTestUtils'
import type { AutoPagePayload } from './types'
import { resetAutoPageEmitterState, useAutoPageEmitter } from './useAutoPageEmitter'

function TestAutoPageEmitter({
  enabled = true,
  routeKey,
  payload,
  buildPayload,
}: {
  enabled?: boolean
  routeKey: string
  payload?: AutoPagePayload
  buildPayload?: (metadata: { isInitialEmission: boolean }) => AutoPagePayload
}): null {
  useAutoPageEmitter({
    enabled,
    routeKey,
    buildPayload: buildPayload ?? ((): AutoPagePayload => payload ?? {}),
  })

  return null
}

describe('useAutoPageEmitter', () => {
  void beforeEach(() => {
    resetAutoPageEmitterState()
  })

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

  it('tracks identical route keys independently for different SDK instances', async () => {
    const firstPage = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const secondPage = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const firstSdk = createOptimizationSdk({ page: firstPage })
    const secondSdk = createOptimizationSdk({ page: secondPage })
    const first = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" />,
      firstSdk,
    )

    await first.unmount()

    const second = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/" />,
      secondSdk,
    )

    expect(firstPage).toHaveBeenCalledTimes(1)
    expect(secondPage).toHaveBeenCalledTimes(1)

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

  it('treats offline queued page events as accepted for route deduplication', async () => {
    const page = rs.fn(async (_payload?: AutoPagePayload) => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({
      page,
    })
    const first = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/offline" />,
      sdk,
    )

    await first.unmount()

    const second = await renderWithOptimizationProviders(
      <TestAutoPageEmitter routeKey="/offline" />,
      sdk,
    )

    expect(page).toHaveBeenCalledTimes(1)

    await second.unmount()
  })
})
