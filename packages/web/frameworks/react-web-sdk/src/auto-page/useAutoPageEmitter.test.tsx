import { rs } from '@rstest/core'
import { StrictMode } from 'react'
import { createOptimizationSdk, renderWithOptimizationProviders } from '../test/sdkTestUtils'
import type { AutoPagePayload } from './types'
import { resetAutoPageEmitterState, useAutoPageEmitter } from './useAutoPageEmitter'

function TestAutoPageEmitter({
  enabled = true,
  routeKey,
  pagePayload,
  getPagePayload,
}: {
  enabled?: boolean
  routeKey: string
  pagePayload?: AutoPagePayload
  getPagePayload?: (context: { routeKey: string; isInitialEmission: boolean }) => AutoPagePayload
}): null {
  useAutoPageEmitter({
    enabled,
    route: {
      routeKey,
      context: {
        routeKey,
      },
    },
    pagePayload,
    getPagePayload: getPagePayload
      ? ({ routeKey: currentRouteKey, isInitialEmission }) =>
          getPagePayload({ routeKey: currentRouteKey, isInitialEmission })
      : undefined,
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

  it('merges static and dynamic payloads with dynamic precedence', async () => {
    const page = rs.fn(async () => {
      await Promise.resolve()
      return undefined
    })
    const sdk = createOptimizationSdk({ page })
    const rendered = await renderWithOptimizationProviders(
      <TestAutoPageEmitter
        routeKey="/checkout"
        pagePayload={{
          locale: 'fr-FR',
          properties: {
            source: 'static',
            stableKey: 'yes',
          },
        }}
        getPagePayload={({ routeKey, isInitialEmission }) => ({
          locale: isInitialEmission ? 'en-US' : 'de-DE',
          properties: {
            routeKey,
            source: 'dynamic',
          },
        })}
      />,
      sdk,
    )

    expect(page).toHaveBeenCalledWith({
      locale: 'en-US',
      properties: {
        source: 'dynamic',
        stableKey: 'yes',
        routeKey: '/checkout',
      },
    })

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
})
