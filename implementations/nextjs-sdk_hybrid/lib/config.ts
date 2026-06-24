const env = process.env
const APP_ENVIRONMENT = (
  env.PUBLIC_APP_ENVIRONMENT?.trim() ??
  env.VERCEL_ENV?.trim() ??
  env.NODE_ENV ??
  'development'
).toLowerCase()

export const APP_LOCALE = 'en-US'
export const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

export const appConfig = {
  environment: APP_ENVIRONMENT,
  previewPanelEnabled: ['development', 'preview', 'staging'].includes(APP_ENVIRONMENT),
} as const

export const optimizationConfig = {
  clientId: env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id',
  environment: env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main',
  locale: APP_LOCALE,
  api: {
    insightsBaseUrl: env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/',
    experienceBaseUrl:
      env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/',
  },
} as const
