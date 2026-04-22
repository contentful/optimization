import { createClient, type Entry } from 'contentful'
import {
  CONTENTFUL_BASE_PATH,
  CONTENTFUL_ENVIRONMENT,
  CONTENTFUL_HOST,
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_TOKEN,
  ENTRY_IDS,
} from './constants'

export async function fetchDevEntries(): Promise<Map<string, Entry>> {
  const client = createClient({
    space: CONTENTFUL_SPACE_ID,
    environment: CONTENTFUL_ENVIRONMENT,
    accessToken: CONTENTFUL_TOKEN,
    host: CONTENTFUL_HOST,
    basePath: CONTENTFUL_BASE_PATH,
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
