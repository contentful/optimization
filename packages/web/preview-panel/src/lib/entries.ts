import type { ContentfulEntryCollection } from '@contentful/optimization-core/preview-support'
import {
  isRecord,
  type AudienceEntry,
  type OptimizationEntry,
} from '@contentful/optimization-web/api-schemas'
import type {
  ChainModifiers,
  ContentfulClientApi,
  EntriesQueriesWithCursor,
  Entry,
  EntrySkeletonType,
} from 'contentful'

const DEFAULT_PAGE_SIZE = 100

interface CursorQuery {
  include?: number
}

interface CursorResponse<S extends EntrySkeletonType, M extends ChainModifiers> {
  items: Array<Entry<S, M>>
  includes?: {
    Entry?: Array<Entry<EntrySkeletonType, M>>
  }
  pages?: { next?: string }
}

/** @internal */
function getContentTypeId(entry: unknown): string | undefined {
  if (!isRecord(entry)) return undefined

  const { sys } = entry
  if (!isRecord(sys)) return undefined

  const { contentType } = sys
  if (!isRecord(contentType)) return undefined

  const { sys: contentTypeSys } = contentType
  if (!isRecord(contentTypeSys)) return undefined

  const { id } = contentTypeSys
  return typeof id === 'string' ? id : undefined
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
export function isAudienceEntry(audience: unknown): audience is AudienceEntry {
  return getContentTypeId(audience) === 'nt_audience'
}

/**
 * Type guard that checks whether a Contentful entry is an {@link OptimizationEntry}.
 *
 * @param optimization - The entry to check.
 * @returns `true` if the entry's content type is `nt_experience`.
 *
 * @example
 * ```ts
 * const filtered = entries.filter(isOptimizationEntry)
 * ```
 *
 * @public
 */
export function isOptimizationEntry(optimization: unknown): optimization is OptimizationEntry {
  return getContentTypeId(optimization) === 'nt_experience'
}

/**
 * Fetches all entries of a given content type using cursor-based pagination.
 *
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
 * const audiences = await getAllEntries(client, 'nt_audience')
 * ```
 *
 * @public
 */
export async function getAllEntries<M extends ChainModifiers = ChainModifiers>(
  client: ContentfulClientApi<M>,
  contentTypeId: string,
  query: CursorQuery = {},
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ContentfulEntryCollection<M>> {
  const items: Array<Entry<EntrySkeletonType, M>> = []
  const includedEntries = new Map<string, Entry<EntrySkeletonType, M>>()
  let pageNext: string | undefined = undefined

  // Widen only for the merge step (prevents excessive type instantiation).
  const queryRecord: Record<string, unknown> = { ...query }

  do {
    const requestQuery: EntriesQueriesWithCursor<EntrySkeletonType, M> = {
      ...queryRecord,
      content_type: contentTypeId,
      limit: pageSize,
      ...(pageNext === undefined ? {} : { pageNext }),
    }

    const res: CursorResponse<EntrySkeletonType, M> =
      await client.getEntriesWithCursor(requestQuery)

    items.push(...res.items)
    res.includes?.Entry?.forEach((entry) => {
      includedEntries.set(entry.sys.id, entry)
    })

    const next: string | undefined = res.pages?.next
    pageNext = next
  } while (pageNext !== undefined)

  return {
    items,
    total: items.length,
    skip: 0,
    limit: items.length,
    includes: includedEntries.size ? { Entry: [...includedEntries.values()] } : undefined,
  }
}
