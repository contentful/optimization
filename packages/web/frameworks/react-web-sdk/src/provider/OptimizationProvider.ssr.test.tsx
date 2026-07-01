import ContentfulOptimization from '@contentful/optimization-web'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { OptimizationProvider, useOptimization, type OptimizationSdk } from '../index'

// Simulate a server (Node.js) environment: isBrowser() returning false causes
// OptimizationProvider to initialize the SDK synchronously inside useState rather
// than deferring to useLayoutEffect.
rs.mock('@contentful/optimization-web/lib/isBrowser', () => ({
  isBrowser: () => false,
}))

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

describe('OptimizationProvider — SSR (isBrowser: false)', () => {
  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
  })

  it('renders children during renderToString — provider does not return null on server', () => {
    let renderedChild = false

    function Probe(): null {
      renderedChild = true
      return null
    }

    renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(renderedChild).toBe(true)
  })

  it('useOptimization returns a real ContentfulOptimization SDK during renderToString', () => {
    let capturedSdk: OptimizationSdk | undefined = undefined

    function Probe(): null {
      capturedSdk = useOptimization()
      return null
    }

    renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Probe />
      </OptimizationProvider>,
    )

    expect(capturedSdk).toBeInstanceOf(ContentfulOptimization)
  })

  it('useOptimization returns a real SDK to deeply nested children during renderToString', () => {
    const capturedSdks: OptimizationSdk[] = []

    function DeepChild(): null {
      capturedSdks.push(useOptimization())
      return null
    }

    function MiddleComponent(): ReactElement {
      return <DeepChild />
    }

    renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <MiddleComponent />
      </OptimizationProvider>,
    )

    expect(capturedSdks).toHaveLength(1)
    expect(capturedSdks[0]).toBeInstanceOf(ContentfulOptimization)
  })

  it('server render produces non-empty HTML markup', () => {
    function Content(): ReactElement {
      return <div data-testid="content">hello</div>
    }

    const markup = renderToString(
      <OptimizationProvider
        clientId={testConfig.clientId}
        environment={testConfig.environment}
        api={testConfig.api}
      >
        <Content />
      </OptimizationProvider>,
    )

    expect(markup).toContain('hello')
  })

  it('allows multiple sequential renderToString calls — no singleton lock contention across requests', () => {
    function Probe(): null {
      useOptimization()
      return null
    }

    const render = (): void => {
      renderToString(
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
        >
          <Probe />
        </OptimizationProvider>,
      )
      // In a real Node.js environment (no window), each render creates a fresh SDK that is
      // garbage-collected after renderToString without cleanup. In happy-dom, window is present
      // so window.contentfulOptimization must be cleared between renders to avoid the browser
      // singleton guard from triggering — simulating the per-request isolation of a real server.
      window.contentfulOptimization?.destroy()
      delete window.contentfulOptimization
    }

    expect(render).not.toThrow()
    expect(render).not.toThrow()
    expect(render).not.toThrow()
  })
})
