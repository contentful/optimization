const CLIENT_ID = process.env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id'
const ENVIRONMENT = process.env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main'
const INSIGHTS_BASE_URL =
  process.env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/'
const EXPERIENCE_BASE_URL =
  process.env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/'
const APP_ENVIRONMENT = (
  process.env.PUBLIC_APP_ENVIRONMENT?.trim() ??
  process.env.VERCEL_ENV?.trim() ??
  process.env.NODE_ENV ??
  'development'
).toLowerCase()
const PREVIEW_PANEL_APP_ENVIRONMENTS: readonly string[] = ['development', 'preview', 'staging']
export const APP_LOCALE = 'en-US'

export const appConfig = {
  environment: APP_ENVIRONMENT,
  previewPanelEnabled: PREVIEW_PANEL_APP_ENVIRONMENTS.includes(APP_ENVIRONMENT),
} as const

export const optimizationConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
  locale: APP_LOCALE,
  api: {
    insightsBaseUrl: INSIGHTS_BASE_URL,
    experienceBaseUrl: EXPERIENCE_BASE_URL,
  },
} as const

export const contentfulConfig = {
  accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN?.trim() ?? '',
  environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT?.trim() ?? '',
  host: process.env.PUBLIC_CONTENTFUL_CDA_HOST?.trim() ?? '',
  space: process.env.PUBLIC_CONTENTFUL_SPACE_ID?.trim() ?? '',
  basePath: process.env.PUBLIC_CONTENTFUL_BASE_PATH?.trim(),
} as const
