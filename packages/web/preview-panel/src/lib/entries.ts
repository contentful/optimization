import type { AudienceEntry, PersonalizationEntry } from '@contentful/optimization-web/api-schemas'
import type {
  ChainModifiers,
  ContentfulClientApi,
  EntriesQueriesWithCursor,
  Entry,
  EntrySkeletonType,
} from 'contentful'

const DEFAULT_PAGE_SIZE = 100

type CursorQuery<S extends EntrySkeletonType, M extends ChainModifiers> = Partial<
  EntriesQueriesWithCursor<S, M>
>

interface CursorResponse<S extends EntrySkeletonType, M extends ChainModifiers> {
  items: Array<Entry<S, M>>
  pages?: { next?: string }
}

/**
 * Type guard that checks whether a Contentful entry is an {@link AudienceEntry}.
 *
 * @param audience - The entry to check.
 * @returns `true` if the entry's content type is `nt_audience`.
 *
 * @example
 * ```ts
 * const filtered = entries.filter(isAudienceEntry)
 * ```
 *
 * @public
 */
export function isAudienceEntry(audience: Entry): audience is AudienceEntry {
  return audience.sys.contentType.sys.id === 'nt_audience'
}

/**
 * Type guard that checks whether a Contentful entry is a {@link PersonalizationEntry}.
 *
 * @param personalization - The entry to check.
 * @returns `true` if the entry's content type is `nt_experience`.
 *
 * @example
 * ```ts
 * const filtered = entries.filter(isPersonalizationEntry)
 * ```
 *
 * @public
 */
export function isPersonalizationEntry(
  personalization: Entry,
): personalization is PersonalizationEntry {
  return personalization.sys.contentType.sys.id === 'nt_experience'
}

/**
 * Fetches all entries of a given content type using cursor-based pagination.
 *
 * @typeParam S - The entry skeleton type constraining the content type query.
 * @typeParam M - Chain modifiers for the Contentful client.
 * @param client - Contentful client instance.
 * @param contentTypeId - The content type ID to query.
 * @param query - Additional query parameters merged into each request.
 * @param pageSize - Number of entries per page.
 * @returns All matching entries across all pages.
 *
 * @defaultValue `pageSize` is `100`.
 *
 * @example
 * ```ts
 * const audiences = await getAllEntries<AudienceEntrySkeleton>(client, 'nt_audience')
 * ```
 *
 * @public
 */
export async function getAllEntries<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
>(
  client: ContentfulClientApi<M>,
  contentTypeId: S['contentTypeId'],
  query: CursorQuery<S, M> = {},
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Array<Entry<S, M>>> {
  const items: Array<Entry<S, M>> = []
  let pageNext: string | undefined = undefined

  // Widen only for the merge step (prevents excessive type instantiation).
  const queryRecord: Record<string, unknown> = query

  do {
    const requestQuery: EntriesQueriesWithCursor<S, M> = {
      ...queryRecord,
      content_type: contentTypeId,
      limit: pageSize,
      ...(pageNext === undefined ? {} : { pageNext }),
    }

    const res: CursorResponse<S, M> = await client.getEntriesWithCursor<S>(requestQuery)

    items.push(...res.items)

    const next: string | undefined = res.pages?.next
    pageNext = next
  } while (pageNext !== undefined)

  return items
}
