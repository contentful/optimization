import { OptimizationRoot } from '@contentful/optimization-react-web'
import { ReactRouterAutoPageTracker } from '@contentful/optimization-react-web/router/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import App from './App'
import { HOME_PATH, PAGE_TWO_PATH } from './config/routes'

const CLIENT_ID = import.meta.env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id'
const ENVIRONMENT = import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main'
const INSIGHTS_BASE_URL =
  import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/'
const EXPERIENCE_BASE_URL =
  import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/'

type LogLevel = 'debug' | 'warn' | 'error'

function resolveLogLevel(): LogLevel {
  const raw = import.meta.env.PUBLIC_OPTIMIZATION_LOG_LEVEL?.trim().toLowerCase()

  if (raw === 'debug' || raw === 'warn' || raw === 'error') {
    return raw
  }

  return import.meta.env.DEV ? 'debug' : 'warn'
}

function RootLayout(): React.ReactElement {
  return (
    <OptimizationRoot
      clientId={CLIENT_ID}
      environment={ENVIRONMENT}
      api={{
        insightsBaseUrl: INSIGHTS_BASE_URL,
        experienceBaseUrl: EXPERIENCE_BASE_URL,
      }}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel={resolveLogLevel()}
      app={{
        name: 'ContentfulOptimization SDK - React Web SDK Reference',
        version: '0.1.0',
      }}
    >
      <ReactRouterAutoPageTracker />
      <Outlet />
    </OptimizationRoot>
  )
}

const router = createBrowserRouter([
  {
    path: HOME_PATH,
    element: <RootLayout />,
    children: [
      { index: true, element: <App /> },
      { path: PAGE_TWO_PATH, element: <App /> },
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
