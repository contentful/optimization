import { logger } from '@contentful/optimization-core'
import type { ContentfulClient, ContentfulEntry } from '../types'

const BATCH_SIZE = 100

/**
 * Fetches all entries of a specific content type from Contentful,
 * handling pagination automatically by batching requests.
 *
 * @param client - The Contentful client instance
 * @param contentType - The content type ID to fetch (e.g., 'nt_audience', 'nt_experience')
 * @param include - Depth of linked entries to resolve (default: 10)
 * @returns Promise resolving to an array of all entries
 */
export async function fetchAllEntriesByContentType(
  client: ContentfulClient,
  contentType: string,
  include = 10,
): Promise<ContentfulEntry[]> {
  const allEntries: ContentfulEntry[] = []
  let skip = 0
  let total = 0

  do {
    const response = await client.getEntries({
      content_type: contentType,
      include,
      skip,
      limit: BATCH_SIZE,
    })

    const { items, total: responseTotal } = response
    allEntries.push(...items)
    total = responseTotal
    skip += BATCH_SIZE

    logger.debug(`[contentfulUtils] Fetched ${contentType} batch`, {
      fetched: response.items.length,
      accumulated: allEntries.length,
      total,
    })
  } while (allEntries.length < total)

  return allEntries
}

/**
 * Fetches all audience and experience entries from Contentful in parallel.
 *
 * @param client - The Contentful client instance
 * @returns Promise resolving to an object containing audience and experience entries
 */
export async function fetchAudienceAndExperienceEntries(
  client: ContentfulClient,
): Promise<{ audiences: ContentfulEntry[]; experiences: ContentfulEntry[] }> {
  logger.debug('[contentfulUtils] Fetching audience and experience entries...')

  const [audiences, experiences] = await Promise.all([
    fetchAllEntriesByContentType(client, 'nt_audience'),
    fetchAllEntriesByContentType(client, 'nt_experience'),
  ])

  logger.debug('[contentfulUtils] All entries fetched successfully', {
    audienceCount: audiences.length,
    experienceCount: experiences.length,
  })

  return { audiences, experiences }
}
