import type { ContentEntry, ContentEntrySkeleton } from '@/types/contentful'
import { createClient } from 'contentful'
import { contentfulConfig } from './config'

const INCLUDE_DEPTH = 10

function createContentfulClient(): ReturnType<typeof createClient> {
  return createClient({
    accessToken: contentfulConfig.accessToken,
    environment: contentfulConfig.environment,
    host: contentfulConfig.host,
    insecure: contentfulConfig.host.includes('localhost'),
    space: contentfulConfig.space,
    ...(contentfulConfig.basePath ? { basePath: contentfulConfig.basePath } : {}),
  })
}

const contentfulClient = createContentfulClient()

export async function fetchEntry(entryId: string): Promise<ContentEntry | undefined> {
  try {
    return await contentfulClient.getEntry<ContentEntrySkeleton>(entryId, {
      include: INCLUDE_DEPTH,
    })
  } catch {
    return undefined
  }
}

export async function fetchEntries(entryIds: readonly string[]): Promise<ContentEntry[]> {
  const fetchedEntries = await Promise.all(entryIds.map(fetchEntry))

  return fetchedEntries.filter((entry): entry is ContentEntry => entry !== undefined)
}
