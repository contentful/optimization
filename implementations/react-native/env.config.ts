import {
  CONTENTFUL_BASE_PATH,
  CONTENTFUL_CDA_HOST,
  CONTENTFUL_ENVIRONMENT,
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_TOKEN,
  EXPERIENCE_API_BASE_URL,
  INSIGHTS_API_BASE_URL,
  NINETAILED_CLIENT_ID,
  NINETAILED_ENVIRONMENT,
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
    spaceId: CONTENTFUL_SPACE_ID,
    environment: CONTENTFUL_ENVIRONMENT,
    accessToken: CONTENTFUL_TOKEN,
    host: CONTENTFUL_CDA_HOST,
    basePath: CONTENTFUL_BASE_PATH,
  },

  optimization: {
    clientId: NINETAILED_CLIENT_ID,
    environment: NINETAILED_ENVIRONMENT,
  },

  api: {
    experienceBaseUrl: EXPERIENCE_API_BASE_URL,
    insightsBaseUrl: INSIGHTS_API_BASE_URL,
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
