import {
  PUBLIC_CONTENTFUL_BASE_PATH,
  PUBLIC_CONTENTFUL_CDA_HOST,
  PUBLIC_CONTENTFUL_ENVIRONMENT,
  PUBLIC_CONTENTFUL_SPACE_ID,
  PUBLIC_CONTENTFUL_TOKEN,
  PUBLIC_EXPERIENCE_API_BASE_URL,
  PUBLIC_INSIGHTS_API_BASE_URL,
  PUBLIC_NINETAILED_CLIENT_ID,
  PUBLIC_NINETAILED_ENVIRONMENT,
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
    nested: string
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
    nested: '1JAU028vQ7v6nB2swl3NBo',
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
