import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import { OptimizationRoot } from '../../src'
import { ReactRouterAutoPageTracker } from '../../src/router/react-router'

import { App } from './App'
import { CLIENT_ID, ENVIRONMENT, EXPERIENCE_BASE_URL, INSIGHTS_BASE_URL } from './constants'
import './styles.css'

function RootLayout(): ReactElement {
  return (
    <OptimizationRoot
      clientId={CLIENT_ID}
      environment={ENVIRONMENT}
      api={{
        insightsBaseUrl: INSIGHTS_BASE_URL,
        experienceBaseUrl: EXPERIENCE_BASE_URL,
      }}
      liveUpdates={true}
    >
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
            path: context.url,
            pathname: context.pathname,
          },
        })}
      />
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
