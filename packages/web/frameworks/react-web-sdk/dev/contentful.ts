import { createClient, type Entry } from 'contentful'
import {
  DEFAULT_CONTENTFUL_BASE_PATH,
  DEFAULT_CONTENTFUL_ENVIRONMENT,
  DEFAULT_CONTENTFUL_HOST,
  DEFAULT_CONTENTFUL_SPACE_ID,
  DEFAULT_CONTENTFUL_TOKEN,
  ENTRY_IDS,
} from './constants'

function getEnvString(key: string): string | undefined {
  const value: unknown = Reflect.get(import.meta.env as object, key)

  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export async function fetchDevEntries(): Promise<Map<string, Entry>> {
  const client = createClient({
    space: getEnvString('PUBLIC_CONTENTFUL_SPACE_ID') ?? DEFAULT_CONTENTFUL_SPACE_ID,
    environment: getEnvString('PUBLIC_CONTENTFUL_ENVIRONMENT') ?? DEFAULT_CONTENTFUL_ENVIRONMENT,
    accessToken: getEnvString('PUBLIC_CONTENTFUL_TOKEN') ?? DEFAULT_CONTENTFUL_TOKEN,
    host: getEnvString('PUBLIC_CONTENTFUL_CDA_HOST') ?? DEFAULT_CONTENTFUL_HOST,
    basePath: getEnvString('PUBLIC_CONTENTFUL_BASE_PATH') ?? DEFAULT_CONTENTFUL_BASE_PATH,
    insecure: true,
  })

  const entries = await Promise.all(
    ENTRY_IDS.map(async (id) => await client.getEntry(id, { include: 10 })),
  )

  const byId = new Map<string, Entry>()
  entries.forEach((entry) => {
    byId.set(entry.sys.id, entry)
  })

  return byId
}
