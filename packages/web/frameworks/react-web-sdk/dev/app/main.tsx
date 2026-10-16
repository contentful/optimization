import { isRecord } from '@contentful/optimization-web/api-schemas'
import { StrictMode, useRef, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { LiveUpdatesProvider, OptimizationProvider, OptimizationRoot } from '../../src'
import type { ContentOptimizationHandoff } from '../../src/handoff'
import { ReactRouterAutoPageTracker } from '../../src/router/react-router'

import { createScopedLogger } from '../../src/logger'
import { App } from './App'
import {
  CONTENTFUL_SPACE_ID,
  ENVIRONMENT,
  EXPERIENCE_BASE_URL,
  INSIGHTS_BASE_URL,
} from './constants'
import './styles.css'

const mode = new URLSearchParams(window.location.search)
const config = {
  spaceId: CONTENTFUL_SPACE_ID,
  environment: ENVIRONMENT,
  api: { insightsBaseUrl: INSIGHTS_BASE_URL, experienceBaseUrl: EXPERIENCE_BASE_URL },
}
function isPreparedHandoff(value: unknown): value is ContentOptimizationHandoff {
  return (
    isRecord(value) &&
    isRecord(value.cache) &&
    value.cache.scope === 'private-request' &&
    value.hydration === 'preserve-server'
  )
}

let handoff: ContentOptimizationHandoff | undefined = undefined
let handoffError: string | undefined = undefined
if (mode.get('handoff') === 'true') {
  try {
    const response = await fetch(`/__handoff?url=${encodeURIComponent(window.location.href)}`)
    if (!response.ok) throw new Error(`Preview endpoint returned ${response.status}`)
    const prepared: unknown = await response.json()
    if (!isPreparedHandoff(prepared)) throw new Error('Invalid dev handoff response')
    handoff = prepared
  } catch (error) {
    handoffError = 'Preview unavailable; using the ordinary browser flow.'
    createScopedLogger('React:Dev').warn(handoffError, error)
  }
}

function RootLayout(): ReactElement {
  const location = useLocation()
  const firstLocation = useRef(location)
  const initialHandoff = useRef(handoff)
  if (location !== firstLocation.current) initialHandoff.current = undefined
  const { current: currentHandoff } = initialHandoff
  const pairedRoute = currentHandoff?.replay?.routeKey
  const tracker =
    currentHandoff === undefined ? (
      <ReactRouterAutoPageTracker
        pagePayload={{
          properties: {
            app: 'react-web-sdk-dev',
            source: 'dev-harness',
          },
        }}
        getPagePayload={({ context }) => ({
          properties: {
            hash: context.hash,
            path: context.pathname,
            pathname: context.pathname,
          },
        })}
      />
    ) : null
  if (mode.get('provider') === 'config' && handoff === undefined) {
    return (
      <OptimizationProvider {...config}>
        <LiveUpdatesProvider globalLiveUpdates>
          {tracker}
          <Outlet />
        </LiveUpdatesProvider>
      </OptimizationProvider>
    )
  }
  return (
    <OptimizationRoot
      {...config}
      handoff={currentHandoff}
      routeKey={pairedRoute}
      liveUpdates
      defaults={handoff ? { consent: true, persistenceConsent: true } : undefined}
    >
      {handoffError ? <p role="status">{handoffError}</p> : null}
      {tracker}
      <Outlet />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <App /> },
      { path: 'events', element: <App /> },
      { path: 'optimization', element: <App /> },
    ],
  },
])

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
