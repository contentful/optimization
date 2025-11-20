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
  contentful: {
    spaceId: VITE_CONTENTFUL_SPACE_ID,
    environment: VITE_CONTENTFUL_ENVIRONMENT,
    accessToken: VITE_CONTENTFUL_TOKEN,
    host: VITE_CONTENTFUL_CDA_HOST,
    basePath: VITE_CONTENTFUL_BASE_PATH,
  },

  optimization: {
    clientId: VITE_NINETAILED_CLIENT_ID,
    environment: VITE_NINETAILED_ENVIRONMENT,
  },

  api: {
    experienceBaseUrl: VITE_EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: VITE_INSIGHTS_API_BASE_URL,
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
