const env = process.env

export const appConfig = {
  locale: 'en-US',
  personalizationConsentCookie: 'app-personalization-consent',
  previewPanelEnabled: env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true',
  spaceId: env.PUBLIC_CONTENTFUL_SPACE_ID?.trim() ?? 'mock-space-id',
  clientId: env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id',
  environment: env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main',
  contentfulEnvironment: env.PUBLIC_CONTENTFUL_ENVIRONMENT?.trim() ?? 'master',
  api: {
    insightsBaseUrl: env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/',
    experienceBaseUrl:
      env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/',
  },
} as const
