import ContentfulOptimization from '@contentful/optimization-web'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { logger } from '@contentful/optimization-web/logger'
import { describe, expect, it, rs } from '@rstest/core'
import { act, useContext, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import { OptimizationRoot } from './OptimizationRoot'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

function createContentHandoff(
  overrides: Partial<ContentOptimizationHandoff> = {},
): ContentOptimizationHandoff {
  return {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    initialPageEvent: 'skip',
    state: { selectedOptimizations: [] },
    ...overrides,
  }
}

async function renderClientAsync(element: ReactElement): Promise<{ unmount: () => void }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(element)
    await Promise.resolve()
    await Promise.resolve()
  })

  return {
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('OptimizationRoot handoff', () => {
  it('emits the initial browser page event from explicit route payload props', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const buildPagePayload = rs.fn(() => ({ properties: { route: '/products' } }))

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
        routeKey="/products"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/products',
    })

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('emits the initial browser page event from a serializable initial payload', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const initialPagePayload = { properties: { route: '/products' } }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
        routeKey="/products"
        initialPagePayload={initialPagePayload}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/products',
    })
    const firstCall = trackCurrentPage.mock.calls[0]
    if (firstCall === undefined) throw new Error('Expected trackCurrentPage to be called.')
    const [{ buildPayload }] = firstCall
    expect(buildPayload({ isInitialEmission: true })).toBe(initialPagePayload)

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('warns and skips initial browser page emission without route payload props', async () => {
    const trackCurrentPage = rs.spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
    const warn = rs.spyOn(logger, 'warn').mockImplementation(() => undefined)

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ initialPageEvent: 'emit' })}
      >
        <div />
      </OptimizationRoot>,
    )

    expect(trackCurrentPage).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'React:OptimizationRoot',
      expect.stringContaining('without routeKey and buildPagePayload'),
    )

    rendered.unmount()
    trackCurrentPage.mockRestore()
    warn.mockRestore()
  })

  it('lets the root hydration prop override handoff hydration for children', async () => {
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationRoot
        {...testConfig}
        handoff={createContentHandoff({ hydration: 'client-only-hidden-until-ready' })}
        hydration="preserve-server"
      >
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedHydration).toBe('preserve-server')

    rendered.unmount()
  })

  it('makes preserve-server hydration visible to children without a handoff', async () => {
    let capturedHydration: unknown

    function Probe(): null {
      capturedHydration = useContext(OptimizationHydrationContext)
      return null
    }

    const rendered = await renderClientAsync(
      <OptimizationRoot {...testConfig} hydration="preserve-server">
        <Probe />
      </OptimizationRoot>,
    )

    expect(capturedHydration).toBe('preserve-server')

    rendered.unmount()
  })
})
