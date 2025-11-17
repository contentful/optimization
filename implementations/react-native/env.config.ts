/**
 * Environment Configuration for React Native Implementation
 *
 * This file contains the configuration for the mock server.
 * For production, use proper environment variable management.
 */

interface EnvConfig {
  contentful: {
    spaceId: string
    environment: string
    accessToken: string
    host: string
    basePath: string
  }
  optimization: {
    clientId: string
    environment: string
  }
  api: {
    experienceBaseUrl: string
    insightsBaseUrl: string
  }
  entries: {
    personalized: string
    product: string
    mergeTag: string
  }
}

export const ENV_CONFIG = {
  // Contentful Configuration
  contentful: {
    spaceId: 'test-space',
    environment: 'master',
    accessToken: 'test-token',
    host: 'localhost:8000',
    basePath: '/contentful',
  },

  // Optimization SDK Configuration
  optimization: {
    clientId: 'test-client-id',
    environment: 'main',
  },

  // Mock Server URLs (for development/testing)
  api: {
    experienceBaseUrl: 'http://localhost:8000/experience/',
    insightsBaseUrl: 'http://localhost:8000/insights/',
  },

  // Entry IDs from mock server
  entries: {
    personalized: '2Z2WLOx07InSewC3LUB3eX', // Baseline with experiences
    product: '1MwiFl4z7gkwqGYdvCmr8c', // Simple content entry
    mergeTag: '1MwiFl4z7gkwqGYdvCmr8c', // Entry with merge tag in rich text
  },
} as const satisfies EnvConfig

export const {
  contentful: { spaceId: CONTENTFUL_SPACE_ID, accessToken: CONTENTFUL_ACCESS_TOKEN },
  optimization: { clientId: NINETAILED_CLIENT_ID },
} = ENV_CONFIG
