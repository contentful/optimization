import { createClient } from 'contentful'
import { ENV_CONFIG } from '../config/env'
import type { ContentEntrySkeleton, ContentfulEntry } from '../types/contentful'

const INCLUDE_DEPTH = 10

function createContentfulClient(): ReturnType<typeof createClient> {
  return createClient({
    accessToken: ENV_CONFIG.contentful.accessToken,
    basePath: ENV_CONFIG.contentful.basePath,
    environment: ENV_CONFIG.contentful.environment,
    host: ENV_CONFIG.contentful.host,
    insecure: ENV_CONFIG.contentful.host.includes('localhost'),
    space: ENV_CONFIG.contentful.spaceId,
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
