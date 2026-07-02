import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { describe, expect, it } from '@rstest/core'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useConsentState, useProfileState } from '../hooks/useOptimizationState'
import { OptimizationProvider } from './OptimizationProvider'

const testConfig = {
  clientId: 'test-client',
  environment: 'test',
  api: { insightsBaseUrl: 'http://localhost/insights', experienceBaseUrl: 'http://localhost/exp' },
}

function createServerOptimizationState(profileId: string): OptimizationData {
  return {
    changes: [],
    selectedOptimizations: [],
    profile: {
      id: profileId,
      stableId: profileId,
      random: 0.5,
      audiences: [],
      traits: {},
      location: {},
      session: {
        id: `${profileId}-session`,
        isReturningVisitor: false,
        landingPage: {
          path: '/',
          query: {},
          referrer: '',
          search: '',
          title: '',
          url: 'http://localhost/',
        },
        count: 1,
        activeSessionLength: 0,
        averageSessionLength: 0,
      },
    },
  }
}

describe('OptimizationProvider server rendering', () => {
  it('renders read-state hooks into server HTML from configured defaults', () => {
    function Probe(): ReactElement {
      const consent = useConsentState()
      return <span data-testid="consent">{String(consent)}</span>
    }

    const markup = renderToString(
      <OptimizationProvider {...testConfig} defaults={{ consent: true }}>
        <Probe />
      </OptimizationProvider>,
    )

    // The read hook resolves against the snapshot runtime during server render,
    // via useSyncExternalStore's getServerSnapshot — no throw, real HTML.
    expect(markup).toContain('data-testid="consent"')
    expect(markup).toContain('true')
  })

  it('renders profile from serverOptimizationState during server render', () => {
    const serverOptimizationState = createServerOptimizationState('server-profile')

    function Probe(): ReactElement {
      const profile = useProfileState()
      return <span data-testid="profile">{profile?.id ?? 'anonymous'}</span>
    }

    const markup = renderToString(
      <OptimizationProvider {...testConfig} serverOptimizationState={serverOptimizationState}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toContain('server-profile')
  })

  it('reflects a no-consent default in server HTML', () => {
    function Probe(): ReactElement {
      const consent = useConsentState()
      return <span>{consent === undefined ? 'unset' : String(consent)}</span>
    }

    const markup = renderToString(
      <OptimizationProvider {...testConfig}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(markup).toContain('unset')
  })
})
