import { OptimizationRoot } from '@contentful/optimization-react-web'
import { createScopedLogger } from '@contentful/optimization-react-web/logger'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'
import { type ReactElement, StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import App from './App'
import { HOME_PATH } from './config/routes'
import { HomePage } from './pages/HomePage'
import { PageTwoPage } from './pages/PageTwoPage'
import { getContentfulClient } from './services/contentfulClient'

const CLIENT_ID = import.meta.env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id'
const ENVIRONMENT = import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main'
const INSIGHTS_BASE_URL =
  import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/'
const EXPERIENCE_BASE_URL =
  import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/'
const ENABLE_PREVIEW_PANEL = import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

type LogLevel = 'debug' | 'warn' | 'error'

const previewPanelLogger = createScopedLogger('ReactWebReference:PreviewPanel')

function resolveLogLevel(): LogLevel {
  const raw = import.meta.env.PUBLIC_OPTIMIZATION_LOG_LEVEL?.trim().toLowerCase()

  if (raw === 'debug' || raw === 'warn' || raw === 'error') {
    return raw
  }

  return import.meta.env.DEV ? 'debug' : 'warn'
}

function attachPreviewPanel(): void {
  if (!ENABLE_PREVIEW_PANEL) {
    return
  }

  void import('@contentful/optimization-web-preview-panel')
    .then(async ({ default: attachOptimizationPreviewPanel }) => {
      await attachOptimizationPreviewPanel({
        contentful:
          getContentfulClient().withAllLocales.withoutLinkResolution.withoutUnresolvableLinks,
        nonce: undefined,
      })
    })
    .catch((error: unknown) => {
      previewPanelLogger.warn('Failed to attach the Contentful Optimization preview panel.', error)
    })
}

function RootLayout(): ReactElement {
  const [globalLiveUpdates, setGlobalLiveUpdates] = useState(false)

  const handleToggleGlobalLiveUpdates = (): void => {
    setGlobalLiveUpdates((prev) => !prev)
  }

  return (
    <OptimizationRoot
      clientId={CLIENT_ID}
      environment={ENVIRONMENT}
      api={{
        insightsBaseUrl: INSIGHTS_BASE_URL,
        experienceBaseUrl: EXPERIENCE_BASE_URL,
      }}
      trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      autoTrackNodeInteraction={{ views: true }}
      logLevel={resolveLogLevel()}
      app={{
        name: 'ContentfulOptimization SDK - React Web SDK Reference',
        version: '0.1.0',
      }}
      onStatesReady={attachPreviewPanel}
      liveUpdates={globalLiveUpdates}
    >
      <ReactRouterAutoPageTracker />
      <Outlet context={{ onToggleGlobalLiveUpdates: handleToggleGlobalLiveUpdates }} />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: HOME_PATH,
    element: <RootLayout />,
    children: [
      {
        element: <App />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'page-two', element: <PageTwoPage /> },
          { path: '*', element: <Navigate replace to={HOME_PATH} /> },
        ],
      },
    ],
  },
])

function main(): void {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element not found')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

main()
