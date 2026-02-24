import { createClient } from 'contentful'
import type { ContentEntrySkeleton, ContentfulEntry } from '../types/contentful'

const INCLUDE_DEPTH = 10
const CONTENTFUL_ACCESS_TOKEN = import.meta.env.PUBLIC_CONTENTFUL_TOKEN?.trim() ?? ''
const CONTENTFUL_BASE_PATH = import.meta.env.PUBLIC_CONTENTFUL_BASE_PATH?.trim()
const CONTENTFUL_ENVIRONMENT = import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT?.trim() ?? ''
const CONTENTFUL_HOST = import.meta.env.PUBLIC_CONTENTFUL_CDA_HOST?.trim() ?? ''
const CONTENTFUL_SPACE_ID = import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID?.trim() ?? ''

function createContentfulClient(): ReturnType<typeof createClient> {
  return createClient({
    accessToken: CONTENTFUL_ACCESS_TOKEN,
    environment: CONTENTFUL_ENVIRONMENT,
    host: CONTENTFUL_HOST,
    insecure: CONTENTFUL_HOST.includes('localhost'),
    space: CONTENTFUL_SPACE_ID,
    ...(CONTENTFUL_BASE_PATH ? { basePath: CONTENTFUL_BASE_PATH } : {}),
  })
}

const contentfulClient = createContentfulClient()

export async function fetchEntry(entryId: string): Promise<ContentfulEntry | undefined> {
  try {
    return await contentfulClient.getEntry<ContentEntrySkeleton>(entryId, {
      include: INCLUDE_DEPTH,
    })
  } catch {
    return undefined
  }
}

export async function fetchEntries(entryIds: readonly string[]): Promise<ContentfulEntry[]> {
  const fetchedEntries = await Promise.all(entryIds.map(fetchEntry))

  return fetchedEntries.filter((entry): entry is ContentfulEntry => entry !== undefined)
}
