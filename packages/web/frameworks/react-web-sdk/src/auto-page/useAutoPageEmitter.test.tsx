import { rs } from '@rstest/core'
import { StrictMode } from 'react'
import { createOptimizationSdk, renderWithOptimizationProviders } from '../test/sdkTestUtils'
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
    const page = rs.fn(async () => {
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
    const page = rs.fn(async () => {
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
})
