import ContentfulOptimization from '@contentful/optimization-web'
import type { AnalyticsOptimizationHandoff } from '@contentful/optimization-web/analytics'
import { describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useOptimization } from '../hooks/useOptimization'
import { captureRenderError } from '../test/sdkTestUtils'
import { OptimizationAnalyticsRoot } from './OptimizationAnalyticsRoot'

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

const analyticsHandoff: AnalyticsOptimizationHandoff = {
  cache: { scope: 'static' },
  hydration: 'analytics-only',
  initialPageEvent: 'emit',
  state: { selectedOptimizations: [] },
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

describe('OptimizationAnalyticsRoot', () => {
  it('hydrates analytics handoff and tracks the initial route without content context', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const resolveOptimizedEntry = rs.spyOn(
      ContentfulOptimization.prototype,
      'resolveOptimizedEntry',
    )
    const buildPagePayload = rs.fn(() => ({ properties: { route: '/segments/a' } }))

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        buildPagePayload={buildPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: buildPagePayload,
      initialPageEvent: 'emit',
      routeKey: '/segments/a',
    })
    expect(resolveOptimizedEntry).not.toHaveBeenCalled()

    rendered.unmount()
    trackCurrentPage.mockRestore()
    resolveOptimizedEntry.mockRestore()
  })

  it('hydrates analytics handoff with a serializable initial payload', async () => {
    const trackCurrentPage = rs
      .spyOn(ContentfulOptimization.prototype, 'trackCurrentPage')
      .mockResolvedValue({ accepted: true })
    const initialPagePayload = { properties: { route: '/segments/a' } }

    const rendered = await renderClientAsync(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        initialPagePayload={initialPagePayload}
      >
        <div />
      </OptimizationAnalyticsRoot>,
    )

    expect(trackCurrentPage).toHaveBeenCalledWith({
      buildPayload: expect.any(Function),
      initialPageEvent: 'emit',
      routeKey: '/segments/a',
    })
    const firstCall = trackCurrentPage.mock.calls[0]
    if (firstCall === undefined) throw new Error('Expected trackCurrentPage to be called.')
    const [{ buildPayload }] = firstCall
    expect(buildPayload({ isInitialEmission: true })).toBe(initialPagePayload)

    rendered.unmount()
    trackCurrentPage.mockRestore()
  })

  it('does not provide content-resolution context to descendants', () => {
    function Probe(): null {
      useOptimization()
      return null
    }

    const error = captureRenderError(
      <OptimizationAnalyticsRoot
        {...testConfig}
        handoff={analyticsHandoff}
        routeKey="/segments/a"
        buildPagePayload={() => ({})}
      >
        <Probe />
      </OptimizationAnalyticsRoot>,
    )

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected useOptimization to throw')
    }

    expect(error.message).toContain('useOptimization must be used within an OptimizationProvider')
  })
})
