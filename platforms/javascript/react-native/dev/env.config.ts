import dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(process.cwd(), 'platforms/javascript/react-native/.env') })

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
    spaceId: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
    environment: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? '',
    accessToken: process.env.VITE_CONTENTFUL_TOKEN ?? '',
    host: process.env.VITE_CONTENTFUL_CDA_HOST ?? '',
    basePath: process.env.VITE_CONTENTFUL_BASE_PATH ?? '',
  },

  optimization: {
    clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
    environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  },

  api: {
    experienceBaseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL ?? '',
    insightsBaseUrl: process.env.VITE_INSIGHTS_API_BASE_URL ?? '',
  },

  entries: {
    personalized: '2Z2WLOx07InSewC3LUB3eX',
    product: '1MwiFl4z7gkwqGYdvCmr8c',
    mergeTag: '1MwiFl4z7gkwqGYdvCmr8c',
  },
} as const satisfies EnvConfig
