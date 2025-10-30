/**
 * Environment Configuration for React Native Implementation
 *
 * Copy this file to env.config.ts and update values as needed.
 * For production, use proper environment variable management.
 */

export const ENV_CONFIG = {
  // Contentful Configuration
  contentful: {
    spaceId: process.env.VITE_CONTENTFUL_SPACE_ID ?? 'test-space',
    environment: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? 'master',
    accessToken: process.env.VITE_CONTENTFUL_TOKEN ?? 'test-token',
    host: process.env.VITE_CONTENTFUL_CDA_HOST ?? 'localhost',
    basePath: process.env.VITE_CONTENTFUL_BASE_PATH ?? '/contentful',
  },

  // Optimization SDK Configuration
  optimization: {
    clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? 'test-client-id',
    environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? 'main',
  },

  // Mock Server URLs (for development/testing)
  api: {
    experienceBaseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL ?? 'http://localhost/experience/',
    insightsBaseUrl: process.env.VITE_INSIGHTS_API_BASE_URL ?? 'http://localhost/insights/',
  },

  // Entry IDs from mock server
  entries: {
    personalized: process.env.VITE_ENTRY_ID_PERSONALIZED ?? '2Z2WLOx07InSewC3LUB3eX', // Baseline with experiences
    product: process.env.VITE_ENTRY_ID_PRODUCT ?? '1MwiFl4z7gkwqGYdvCmr8c', // Simple content entry
  },
} as const
