/**
 * Environment Configuration for React Native Implementation
 *
 * This file contains the configuration for the mock server.
 * For production, use proper environment variable management.
 */

import { Platform } from 'react-native'

const PUBLIC_NINETAILED_CLIENT_ID = 'test-client-id'
const PUBLIC_NINETAILED_ENVIRONMENT = 'main'
const PUBLIC_EXPERIENCE_API_BASE_URL = 'http://localhost:8000/experience/'
const PUBLIC_INSIGHTS_API_BASE_URL = 'http://localhost:8000/insights/'
const PUBLIC_CONTENTFUL_TOKEN = 'test-token'
const PUBLIC_CONTENTFUL_ENVIRONMENT = 'master'
const PUBLIC_CONTENTFUL_SPACE_ID = 'test-space'
const PUBLIC_CONTENTFUL_CDA_HOST = 'localhost:8000'
const PUBLIC_CONTENTFUL_BASE_PATH = '/contentful/'

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
    deviceType: string
    visitorType: string
    location: string
    customEvent: string
  }
}

const ANDROID_LOCALHOST = '10.0.2.2'

function getAndroidCompatibleUrl(url: string): string {
  if (Platform.OS !== 'android') {
    return url
  }
  return url.replace(/localhost/g, ANDROID_LOCALHOST)
}

export const ENV_CONFIG = {
  contentful: {
    spaceId: PUBLIC_CONTENTFUL_SPACE_ID,
    environment: PUBLIC_CONTENTFUL_ENVIRONMENT,
    accessToken: PUBLIC_CONTENTFUL_TOKEN,
    host: getAndroidCompatibleUrl(PUBLIC_CONTENTFUL_CDA_HOST),
    basePath: PUBLIC_CONTENTFUL_BASE_PATH,
  },

  optimization: {
    clientId: PUBLIC_NINETAILED_CLIENT_ID,
    environment: PUBLIC_NINETAILED_ENVIRONMENT,
  },

  api: {
    experienceBaseUrl: getAndroidCompatibleUrl(PUBLIC_EXPERIENCE_API_BASE_URL),
    insightsBaseUrl: getAndroidCompatibleUrl(PUBLIC_INSIGHTS_API_BASE_URL),
  },

  entries: {
    personalized: '2Z2WLOx07InSewC3LUB3eX',
    product: '1MwiFl4z7gkwqGYdvCmr8c',
    mergeTag: '1MwiFl4z7gkwqGYdvCmr8c',
    deviceType: 'xFwgG3oNaOcjzWiGe4vXo',
    visitorType: '2Z2WLOx07InSewC3LUB3eX',
    location: '4ib0hsHWoSOnCVdDkizE8d',
    customEvent: '6zqoWXyiSrf0ja7I2WGtYj',
  },
} as const satisfies EnvConfig
