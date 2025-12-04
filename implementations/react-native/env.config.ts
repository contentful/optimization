import {
  VITE_CONTENTFUL_BASE_PATH,
  VITE_CONTENTFUL_CDA_HOST,
  VITE_CONTENTFUL_ENVIRONMENT,
  VITE_CONTENTFUL_SPACE_ID,
  VITE_CONTENTFUL_TOKEN,
  VITE_EXPERIENCE_API_BASE_URL,
  VITE_INSIGHTS_API_BASE_URL,
  VITE_NINETAILED_CLIENT_ID,
  VITE_NINETAILED_ENVIRONMENT,
} from '@env'
import { Platform } from 'react-native'

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

const ANDROID_LOCALHOST = '10.0.2.2'

function getAndroidCompatibleUrl(url: string): string {
  if (Platform.OS !== 'android') {
    return url
  }
  return url.replace(/localhost/g, ANDROID_LOCALHOST)
}

export const ENV_CONFIG = {
  contentful: {
    spaceId: VITE_CONTENTFUL_SPACE_ID,
    environment: VITE_CONTENTFUL_ENVIRONMENT,
    accessToken: VITE_CONTENTFUL_TOKEN,
    host: getAndroidCompatibleUrl(VITE_CONTENTFUL_CDA_HOST),
    basePath: VITE_CONTENTFUL_BASE_PATH,
  },

  optimization: {
    clientId: VITE_NINETAILED_CLIENT_ID,
    environment: VITE_NINETAILED_ENVIRONMENT,
  },

  api: {
    experienceBaseUrl: getAndroidCompatibleUrl(VITE_EXPERIENCE_API_BASE_URL),
    insightsBaseUrl: getAndroidCompatibleUrl(VITE_INSIGHTS_API_BASE_URL),
  },

  entries: {
    personalized: '2Z2WLOx07InSewC3LUB3eX',
    product: '1MwiFl4z7gkwqGYdvCmr8c',
    mergeTag: '1MwiFl4z7gkwqGYdvCmr8c',
  },
} as const satisfies EnvConfig

export const {
  contentful: { spaceId, accessToken },
  optimization: { clientId },
} = ENV_CONFIG

export {
  accessToken as CONTENTFUL_ACCESS_TOKEN,
  spaceId as CONTENTFUL_SPACE_ID,
  clientId as NINETAILED_CLIENT_ID,
}
