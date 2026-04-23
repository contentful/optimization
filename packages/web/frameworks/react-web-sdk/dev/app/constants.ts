function getEnvString(key: string): string | undefined {
  const value: unknown = Reflect.get(import.meta.env as object, key)
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export const CONTENTFUL_SPACE_ID = getEnvString('PUBLIC_CONTENTFUL_SPACE_ID') ?? 'test-space'
export const CONTENTFUL_ENVIRONMENT = getEnvString('PUBLIC_CONTENTFUL_ENVIRONMENT') ?? 'master'
export const CONTENTFUL_TOKEN = getEnvString('PUBLIC_CONTENTFUL_TOKEN') ?? 'test-token'
export const CONTENTFUL_HOST = getEnvString('PUBLIC_CONTENTFUL_CDA_HOST') ?? 'localhost:8000'
export const CONTENTFUL_BASE_PATH = getEnvString('PUBLIC_CONTENTFUL_BASE_PATH') ?? '/contentful/'

export const CLIENT_ID = getEnvString('PUBLIC_NINETAILED_CLIENT_ID') ?? 'mock-client-id'
export const ENVIRONMENT = getEnvString('PUBLIC_NINETAILED_ENVIRONMENT') ?? 'main'
export const INSIGHTS_BASE_URL =
  getEnvString('PUBLIC_INSIGHTS_API_BASE_URL') ?? 'http://localhost:8000/insights/'
export const EXPERIENCE_BASE_URL =
  getEnvString('PUBLIC_EXPERIENCE_API_BASE_URL') ?? 'http://localhost:8000/experience/'

export const ENTRY_IDS = [
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
  '6zqoWXyiSrf0ja7I2WGtYj',
] as const

export const BASELINE_IDS = {
  default: '2Z2WLOx07InSewC3LUB3eX',
  live: 'xFwgG3oNaOcjzWiGe4vXo',
  locked: '4ib0hsHWoSOnCVdDkizE8d',
  mergeTagContent: '1MwiFl4z7gkwqGYdvCmr8c',
  nestedParent: '1MwiFl4z7gkwqGYdvCmr8c',
  nestedChild: '6zqoWXyiSrf0ja7I2WGtYj',
} as const
