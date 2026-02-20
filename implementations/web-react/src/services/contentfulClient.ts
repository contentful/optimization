import { createClient } from 'contentful'
import { ENV_CONFIG } from '../config/env'
import { isContentfulEntry, type ContentfulEntry } from '../types/contentful'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasItemsArray(value: unknown): value is { items: unknown[] } {
  return isRecord(value) && Array.isArray(value.items)
}

function toContentfulEntry(value: unknown): ContentfulEntry {
  if (!isContentfulEntry(value)) {
    throw new Error('Contentful response did not contain a valid entry shape')
  }

  return value
}

export async function fetchEntry(entryId: string): Promise<ContentfulEntry | undefined> {
  try {
    const response: unknown = await contentfulClient.getEntries({
      include: INCLUDE_DEPTH,
      'sys.id': entryId,
    })

    if (!hasItemsArray(response) || response.items.length === 0) {
      return undefined
    }

    const { items } = response
    const [firstEntry] = items
    if (!firstEntry) {
      return undefined
    }

    return toContentfulEntry(firstEntry)
  } catch {
    return undefined
  }
}

export async function fetchEntries(entryIds: readonly string[]): Promise<ContentfulEntry[]> {
  const fetchedEntries = await Promise.all(entryIds.map(fetchEntry))

  return fetchedEntries.filter((entry): entry is ContentfulEntry => entry !== undefined)
}
