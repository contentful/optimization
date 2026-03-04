import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationRoot } from '../src'

import { App } from './App'
import './styles.css'

const DEFAULT_CLIENT_ID = 'mock-client-id'
const DEFAULT_ENVIRONMENT = 'main'
const DEFAULT_INSIGHTS_BASE_URL = 'http://localhost:8000/insights/'
const DEFAULT_EXPERIENCE_BASE_URL = 'http://localhost:8000/experience/'

function getEnvString(key: string): string | undefined {
  const value: unknown = Reflect.get(import.meta.env as object, key)

  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const clientId = getEnvString('PUBLIC_NINETAILED_CLIENT_ID') ?? DEFAULT_CLIENT_ID
const environment = getEnvString('PUBLIC_NINETAILED_ENVIRONMENT') ?? DEFAULT_ENVIRONMENT
const insightsBaseUrl = getEnvString('PUBLIC_INSIGHTS_API_BASE_URL') ?? DEFAULT_INSIGHTS_BASE_URL
const experienceBaseUrl =
  getEnvString('PUBLIC_EXPERIENCE_API_BASE_URL') ?? DEFAULT_EXPERIENCE_BASE_URL

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <OptimizationRoot
      clientId={clientId}
      environment={environment}
      analytics={{ baseUrl: insightsBaseUrl }}
      personalization={{ baseUrl: experienceBaseUrl }}
      liveUpdates={true}
    >
      <App />
    </OptimizationRoot>
  </StrictMode>,
)
