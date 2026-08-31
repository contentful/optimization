import { useState, useEffect, useCallback } from 'react'
import ContentfulOptimization from '@contentful/optimization-web'

const CLIENT_ID = import.meta.env.PUBLIC_NINETAILED_CLIENT_ID ?? 'iyqlttzomqet'
const ENVIRONMENT = import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT ?? 'main'
const EXPERIENCE_API_BASE_URL =
  import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL ?? 'https://experience.ninetailed.engineering/'

type SDKState = {
  status: 'loading' | 'ready' | 'error'
  sdk?: ContentfulOptimization
  profile?: any
  experiences?: any[]
  error?: string
}

export function App() {
  const [state, setState] = useState<SDKState>({ status: 'loading' })
  const [rawResponse, setRawResponse] = useState<string>('')

  useEffect(() => {
    async function init() {
      try {
        const sdk = new ContentfulOptimization({
          clientId: CLIENT_ID,
          environment: ENVIRONMENT,
          logLevel: 'debug',
          locale: 'en-US',
          app: { name: 'CF-Entities PoC', version: '0.1.0' },
          api: {
            experienceBaseUrl: EXPERIENCE_API_BASE_URL,
          },
        })

        // Listen for state changes
        sdk.onProfileChange((profile: any) => {
          setState((prev) => ({ ...prev, profile }))
        })

        sdk.onExperienceChange((experiences: any) => {
          setState((prev) => ({ ...prev, experiences }))
        })

        setState({ status: 'ready', sdk })
      } catch (err: any) {
        setState({ status: 'error', error: err.message })
      }
    }

    init()
  }, [])

  const triggerIdentify = useCallback(async () => {
    if (!state.sdk) return

    try {
      await state.sdk.identify('test-user-001', {
        last_email_opened_subject_line: 'Summer Sale',
        most_frequent_product_feature_viewed: 'dashboard',
      })

      // After identify, fetch the raw profile response to see the experience resolution
      const profileId = state.sdk.profileId
      if (profileId) {
        const url = `${EXPERIENCE_API_BASE_URL}v3/spaces/${CLIENT_ID}/environments/${ENVIRONMENT}/profiles/${profileId}`
        const resp = await fetch(url)
        const data = await resp.json()
        setRawResponse(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setRawResponse(`Error: ${err.message}`)
    }
  }, [state.sdk])

  const triggerPageView = useCallback(async () => {
    if (!state.sdk) return

    try {
      await state.sdk.page({ properties: { url: '/pricing' } })

      const profileId = state.sdk.profileId
      if (profileId) {
        const url = `${EXPERIENCE_API_BASE_URL}v3/spaces/${CLIENT_ID}/environments/${ENVIRONMENT}/profiles/${profileId}`
        const resp = await fetch(url)
        const data = await resp.json()
        setRawResponse(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setRawResponse(`Error: ${err.message}`)
    }
  }, [state.sdk])

  return (
    <div>
      <h1>CF-Entities PoC</h1>
      <p className="subtitle">
        Optimization SDK calling dev Experience API via V3 paths (space-scoped)
      </p>

      <div className="card">
        <h2>SDK Status</h2>
        <p>
          <span className={`status status--${state.status === 'error' ? 'error' : state.status === 'ready' ? 'success' : 'loading'}`}>
            {state.status}
          </span>
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
          Space: <code>{CLIENT_ID}</code> | Environment: <code>{ENVIRONMENT}</code>
        </p>
        <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Experience API: <code>{EXPERIENCE_API_BASE_URL}</code>
        </p>
        {state.sdk?.profileId && (
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Profile ID: <code>{state.sdk.profileId}</code>
          </p>
        )}
      </div>

      <div className="card">
        <h2>Trigger Events</h2>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          Send events to the Experience API to trigger audience evaluation and experience resolution.
        </p>
        <button onClick={triggerIdentify} style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}>
          Identify (Segment User traits)
        </button>
        <button onClick={triggerPageView} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}>
          Page View (/pricing)
        </button>
      </div>

      {state.experiences && state.experiences.length > 0 && (
        <div className="card">
          <h2>Resolved Experiences</h2>
          {state.experiences.map((exp: any, i: number) => (
            <div key={i} className="experience">
              <strong>{exp.name || exp.id}</strong>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                ({exp.type})
              </span>
              {exp.selectedVariant && (
                <div className="variant">
                  Selected variant: <code>{JSON.stringify(exp.selectedVariant)}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {state.profile && (
        <div className="card">
          <h2>Profile State</h2>
          <pre>{JSON.stringify(state.profile, null, 2)}</pre>
        </div>
      )}

      {rawResponse && (
        <div className="card">
          <h2>Raw API Response</h2>
          <pre>{rawResponse}</pre>
        </div>
      )}

      {state.error && (
        <div className="card">
          <h2>Error</h2>
          <p className="status status--error">{state.error}</p>
        </div>
      )}
    </div>
  )
}
