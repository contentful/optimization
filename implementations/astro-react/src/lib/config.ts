export const APP_LOCALE = 'en-US'
export const CONSENT_COOKIE = 'astro-optimization-consent'
export const optimizationConfig = {
  spaceId: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID ?? 'mock-space-id',
  environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master',
  locale: APP_LOCALE,
  allowedEventTypes: [],
  api: {
    experienceBaseUrl: import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL,
  },
}
