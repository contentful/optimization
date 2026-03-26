export const DEFAULT_CONTENTFUL_SPACE_ID = 'test-space'
export const DEFAULT_CONTENTFUL_ENVIRONMENT = 'master'
export const DEFAULT_CONTENTFUL_TOKEN = 'test-token'
export const DEFAULT_CONTENTFUL_HOST = 'localhost:8000'
export const DEFAULT_CONTENTFUL_BASE_PATH = '/contentful/'

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
  nestedParent: '1MwiFl4z7gkwqGYdvCmr8c',
  nestedChild: '6zqoWXyiSrf0ja7I2WGtYj',
} as const
