import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { FixedQueryOptions } from 'contentful'
import type { ContentfulClient, ContentfulEntry, ContentfulEntryCollection } from './definitions'

const logger = createScopedLogger('Preview')
const BATCH_SIZE = 100
type ContentfulIncludeDepth = NonNullable<FixedQueryOptions['include']>

/**
 * Fetches all entries of a specific content type from Contentful,
 * handling pagination automatically by batching requests.
 *
 * @param client - The Contentful client instance
 * @param contentType - The content type ID to fetch (e.g., `'nt_audience'`, `'nt_experience'`)
 * @param include - Depth of linked entries to resolve
 * @returns Promise resolving to an entry collection with aggregated items and included entries
 *
 * @defaultValue `10`
 *
 * @public
 */
export async function fetchAllEntriesByContentType(
  client: ContentfulClient,
  contentType: string,
  include: ContentfulIncludeDepth = 10,
): Promise<ContentfulEntryCollection> {
  const allEntries: ContentfulEntry[] = []
  const includedEntries = new Map<string, ContentfulEntry>()
  let skip = 0
  let total = 0
  let lastResponse: ContentfulEntryCollection | undefined = undefined

  do {
    const response = await client.getEntries({
      content_type: contentType,
      include,
      skip,
      limit: BATCH_SIZE,
    })

    lastResponse = response
    const { items, total: responseTotal } = response
    allEntries.push(...items)
    response.includes?.Entry?.forEach((includedEntry) => {
      includedEntries.set(includedEntry.sys.id, includedEntry)
    })
    total = responseTotal
    skip += BATCH_SIZE

    logger.debug(`Fetched ${contentType} batch`, {
      fetched: response.items.length,
      accumulated: allEntries.length,
      total,
    })
  } while (allEntries.length < total)

  return {
    ...lastResponse,
    items: allEntries,
    includes: {
      ...lastResponse.includes,
      ...(includedEntries.size ? { Entry: [...includedEntries.values()] } : {}),
    },
    limit: lastResponse.limit,
    skip: 0,
    total,
  }
}

/**
 * Fetches all audience and experience entries from Contentful in parallel.
 *
 * @param client - The Contentful client instance
 * @returns Promise resolving to an object containing audience and experience entry collections
 *
 * @public
 */
export async function fetchAudienceAndExperienceEntries(
  client: ContentfulClient,
): Promise<{ audiences: ContentfulEntryCollection; experiences: ContentfulEntryCollection }> {
  logger.debug('Fetching audience and experience entries...')

  const [audiences, experiences] = await Promise.all([
    fetchAllEntriesByContentType(client, 'nt_audience'),
    fetchAllEntriesByContentType(client, 'nt_experience'),
  ])

  logger.debug('All entries fetched successfully', {
    audienceCount: audiences.items.length,
    experienceCount: experiences.items.length,
  })

  return { audiences, experiences }
}
