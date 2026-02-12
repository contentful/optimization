import type { AudienceEntry, PersonalizationEntry } from '@contentful/optimization-web'
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

export function isAudienceEntry(audience: Entry): audience is AudienceEntry {
  return audience.sys.contentType.sys.id === 'nt_audience'
}

export function isPersonalizationEntry(
  personalization: Entry,
): personalization is PersonalizationEntry {
  return personalization.sys.contentType.sys.id === 'nt_experience'
}

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
