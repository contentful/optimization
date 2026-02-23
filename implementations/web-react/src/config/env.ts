export interface EnvConfig {
  contentful: {
    accessToken: string
    basePath: string
    environment: string
    host: string
    spaceId: string
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
    abTest: string
    commonDesktop: string
    commonRegion: string
    identified: string
    mergeTag: string
    nested: string
    personalized: string
    withCustomEvent: string
  }
}

type RequiredEnvKey =
  | 'PUBLIC_CONTENTFUL_BASE_PATH'
  | 'PUBLIC_CONTENTFUL_CDA_HOST'
  | 'PUBLIC_CONTENTFUL_ENVIRONMENT'
  | 'PUBLIC_CONTENTFUL_SPACE_ID'
  | 'PUBLIC_CONTENTFUL_TOKEN'
  | 'PUBLIC_EXPERIENCE_API_BASE_URL'
  | 'PUBLIC_INSIGHTS_API_BASE_URL'
  | 'PUBLIC_NINETAILED_CLIENT_ID'
  | 'PUBLIC_NINETAILED_ENVIRONMENT'
function readRequired(key: RequiredEnvKey, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value.trim()
}

export const ENV_CONFIG = {
  contentful: {
    accessToken: readRequired('PUBLIC_CONTENTFUL_TOKEN', import.meta.env.PUBLIC_CONTENTFUL_TOKEN),
    basePath: readRequired(
      'PUBLIC_CONTENTFUL_BASE_PATH',
      import.meta.env.PUBLIC_CONTENTFUL_BASE_PATH,
    ),
    environment: readRequired(
      'PUBLIC_CONTENTFUL_ENVIRONMENT',
      import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT,
    ),
    host: readRequired('PUBLIC_CONTENTFUL_CDA_HOST', import.meta.env.PUBLIC_CONTENTFUL_CDA_HOST),
    spaceId: readRequired('PUBLIC_CONTENTFUL_SPACE_ID', import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID),
  },
  optimization: {
    clientId: readRequired(
      'PUBLIC_NINETAILED_CLIENT_ID',
      import.meta.env.PUBLIC_NINETAILED_CLIENT_ID,
    ),
    environment: readRequired(
      'PUBLIC_NINETAILED_ENVIRONMENT',
      import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT,
    ),
  },
  api: {
    experienceBaseUrl: readRequired(
      'PUBLIC_EXPERIENCE_API_BASE_URL',
      import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    ),
    insightsBaseUrl: readRequired(
      'PUBLIC_INSIGHTS_API_BASE_URL',
      import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL,
    ),
  },
  entries: {
    abTest: '5XHssysWUDECHzKLzoIsg1',
    commonDesktop: 'xFwgG3oNaOcjzWiGe4vXo',
    commonRegion: '4ib0hsHWoSOnCVdDkizE8d',
    identified: '7pa5bOx8Z9NmNcr7mISvD',
    mergeTag: '1MwiFl4z7gkwqGYdvCmr8c',
    nested: '1JAU028vQ7v6nB2swl3NBo',
    personalized: '2Z2WLOx07InSewC3LUB3eX',
    withCustomEvent: '6zqoWXyiSrf0ja7I2WGtYj',
  },
} as const satisfies EnvConfig
