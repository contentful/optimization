import ContentfulOptimization from '@contentful/optimization-web'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { OptimizationProvider, useOptimization, type OptimizationSdk } from '../index'

// Simulate a Node.js / SSR environment: disable browser APIs so the SDK behaves
// as it would on the server — no IntersectionObserver, MutationObserver, or DOM listeners.
rs.mock('@contentful/optimization-web/constants', () => ({
  CAN_ADD_LISTENERS: false,
  HAS_MUTATION_OBSERVER: false,
  OPTIMIZATION_WEB_SDK_NAME: '@contentful/optimization-web',
  OPTIMIZATION_WEB_SDK_VERSION: '0.0.0',
  ANONYMOUS_ID_COOKIE: '__ctfl_anon',
  ENTRY_ID_ATTRIBUTE: 'data-ctfl-entry-id',
  ENTRY_SELECTOR: '[data-ctfl-entry-id]',
}))

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

describe('OptimizationProvider — SSR (CAN_ADD_LISTENERS: false, synchronous useState init)', () => {
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

  it('does not throw when window has a stale singleton from an interrupted render — simulates concurrent render restart', () => {
    // Concurrent React can run the render phase (which calls init() and constructs
    // an SDK) and then discard the work-in-progress tree before effects execute.
    // The SDK constructor sets window.contentfulOptimization but no cleanup runs,
    // so the next render attempt finds a stale singleton and must destroy it first.
    const stale = new ContentfulOptimization(testConfig)
    window.contentfulOptimization = stale

    expect(() => {
      renderToString(
        <OptimizationProvider
          clientId={testConfig.clientId}
          environment={testConfig.environment}
          api={testConfig.api}
        >
          <div />
        </OptimizationProvider>,
      )
    }).not.toThrow()
  })
})
