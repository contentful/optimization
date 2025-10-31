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
  }
}

export const ENV_CONFIG: EnvConfig = {
  // Contentful Configuration
  contentful: {
    spaceId: 'test-space',
    environment: 'master',
    accessToken: 'test-token',
    host: 'localhost',
    basePath: '/contentful',
  },

  // Optimization SDK Configuration
  optimization: {
    clientId: 'test-client-id',
    environment: 'main',
  },

  // Mock Server URLs (for development/testing)
  api: {
    experienceBaseUrl: 'http://localhost/experience/',
    insightsBaseUrl: 'http://localhost/insights/',
  },

  // Entry IDs from mock server
  entries: {
    personalized: '2Z2WLOx07InSewC3LUB3eX', // Baseline with experiences
    product: '1MwiFl4z7gkwqGYdvCmr8c', // Simple content entry
  },
}
