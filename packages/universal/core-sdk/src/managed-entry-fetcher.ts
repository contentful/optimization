import type { EntriesQueries, Entry, EntrySkeletonType } from 'contentful'
import type { ContentfulConfig, ContentfulEntryClient, ContentfulEntryQuery } from './CoreBase'
import type { NormalizedManagedEntryDescriptor } from './managed-entry'
import { getOptimizedEntrySourceKey } from './managed-entry-key'

const DEFAULT_CONTENTFUL_ENTRY_CACHE_MAX_ENTRIES = 100
const DEFAULT_CONTENTFUL_ENTRY_CACHE_TTL_MS = 300_000
const DEFAULT_CONTENTFUL_ENTRY_INCLUDE = 10
const CONTENTFUL_GET_ENTRIES_CHUNK_SIZE = 100

type ResolvedContentfulEntryCacheOptions = readonly [maxEntries: number, ttlMs: number]
type ContentfulEntryCacheRecord = readonly [expiresAt: number, promise: Promise<Entry>]

interface ManagedEntryBatch {
  readonly query: ContentfulEntryQuery
  readonly indexesById: Map<string, number[]>
}

interface PendingSingleEntryBatch {
  readonly client: ContentfulEntryClient
  readonly entryIds: string[]
  flushPromise?: Promise<ReadonlyMap<string, Entry>>
  readonly promisesById: Map<string, Promise<Entry>>
  readonly query: ContentfulEntryQuery
}

function createContentfulEntryQuery(
  defaultQuery: ContentfulEntryQuery | undefined,
  query: ContentfulEntryQuery | undefined,
  locale: string | undefined,
): ContentfulEntryQuery {
  const mergedQuery: ContentfulEntryQuery = {
    ...defaultQuery,
    ...query,
  }

  mergedQuery.include ??= DEFAULT_CONTENTFUL_ENTRY_INCLUDE

  if (mergedQuery.locale === undefined && locale !== undefined) {
    mergedQuery.locale = locale
  }

  return mergedQuery
}

function evictEntryCache(cache: Map<string, ContentfulEntryCacheRecord>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next()
    if (oldestKey.done) break
    cache.delete(oldestKey.value)
  }
}

function getFetchedContentfulEntry(
  entriesById: ReadonlyMap<string, Entry>,
  entryId: string,
): Entry {
  const entry = entriesById.get(entryId)

  if (entry === undefined) {
    throw new Error(`Contentful getEntries() response did not include entry "${entryId}".`)
  }

  return entry
}

async function fetchContentfulEntryBatch(
  getEntries: ContentfulEntryClient['getEntries'],
  query: ContentfulEntryQuery,
  entryIds: string[],
): Promise<ReadonlyMap<string, Entry>> {
  const entriesById = new Map<string, Entry>()

  for (let index = 0; index < entryIds.length; index += CONTENTFUL_GET_ENTRIES_CHUNK_SIZE) {
    const chunk = entryIds.slice(index, index + CONTENTFUL_GET_ENTRIES_CHUNK_SIZE)
    const batchQuery: EntriesQueries<EntrySkeletonType, undefined> = {
      ...query,
      'sys.id[in]': chunk,
      limit: chunk.length,
    }
    const response = await getEntries(batchQuery)

    for (const entry of response.items) {
      entriesById.set(entry.sys.id, entry)
    }
  }

  for (const entryId of entryIds) {
    getFetchedContentfulEntry(entriesById, entryId)
  }

  return entriesById
}

export class ManagedEntryFetcher {
  private readonly entryCache = new Map<string, ContentfulEntryCacheRecord>()
  private readonly entryCacheOptions: ResolvedContentfulEntryCacheOptions | undefined
  private readonly getContentfulConfig: () => ContentfulConfig | undefined
  private readonly getLocale: () => string | undefined
  private readonly pendingSingleBatches = new Map<string, PendingSingleEntryBatch>()

  constructor(
    getContentfulConfig: () => ContentfulConfig | undefined,
    getLocale: () => string | undefined,
  ) {
    this.getContentfulConfig = getContentfulConfig
    this.getLocale = getLocale
    const cache = getContentfulConfig()?.cache
    this.entryCacheOptions =
      cache === false
        ? undefined
        : [
            cache?.maxEntries ?? DEFAULT_CONTENTFUL_ENTRY_CACHE_MAX_ENTRIES,
            cache?.ttlMs ?? DEFAULT_CONTENTFUL_ENTRY_CACHE_TTL_MS,
          ]
  }

  clearCache(): void {
    this.entryCache.clear()
  }

  async fetchEntry(entryId: string, query?: ContentfulEntryQuery): Promise<Entry> {
    const contentful = this.getRequiredContentfulConfig()
    const mergedQuery = createContentfulEntryQuery(contentful.defaultQuery, query, this.getLocale())
    const cacheKey = getOptimizedEntrySourceKey(entryId, mergedQuery)
    const now = Date.now()
    const cached = this.getCachedContentfulEntry(cacheKey, now)

    return await (cached ??
      this.scheduleSingleEntryFetch(contentful.client, entryId, mergedQuery, now))
  }

  async fetchEntries(entries: readonly NormalizedManagedEntryDescriptor[]): Promise<Entry[]> {
    if (entries.length === 0) return []

    const { client, defaultQuery } = this.getRequiredContentfulConfig()
    const now = Date.now()
    const resultPromises = new Array<Promise<Entry>>(entries.length)
    const batches = new Map<string, ManagedEntryBatch>()

    entries.forEach((descriptor, index) => {
      const query = createContentfulEntryQuery(
        defaultQuery,
        descriptor.entryQuery,
        this.getLocale(),
      )
      const cacheKey = getOptimizedEntrySourceKey(descriptor.entryId, query)
      const cached = this.getCachedContentfulEntry(cacheKey, now)

      if (cached !== undefined) {
        resultPromises[index] = cached
        return
      }

      const queryKey = getOptimizedEntrySourceKey('', query)
      let batch = batches.get(queryKey)

      if (batch === undefined) {
        batch = { indexesById: new Map<string, number[]>(), query }
        batches.set(queryKey, batch)
      }

      const indexes = batch.indexesById.get(descriptor.entryId)

      if (indexes === undefined) {
        batch.indexesById.set(descriptor.entryId, [index])
      } else {
        indexes.push(index)
      }
    })

    for (const { indexesById, query } of batches.values()) {
      const entryIds = [...indexesById.keys()]

      if (entryIds.length > 1) {
        const batchPromise = fetchContentfulEntryBatch(client.getEntries, query, entryIds)

        for (const [entryId, indexes] of indexesById) {
          const entryPromise = batchPromise.then((entriesById) =>
            getFetchedContentfulEntry(entriesById, entryId),
          )
          const cached = this.cacheContentfulEntryPromise(
            getOptimizedEntrySourceKey(entryId, query),
            entryPromise,
            now,
          )

          for (const index of indexes) {
            resultPromises[index] = cached
          }
        }

        continue
      }

      for (const [entryId, indexes] of indexesById) {
        const cached = this.cacheContentfulEntryPromise(
          getOptimizedEntrySourceKey(entryId, query),
          client.getEntry(entryId, query),
          now,
        )

        for (const index of indexes) {
          resultPromises[index] = cached
        }
      }
    }

    return await Promise.all(resultPromises)
  }

  private getRequiredContentfulConfig(): ContentfulConfig {
    const contentful = this.getContentfulConfig()

    if (!contentful?.client) {
      throw new Error('Managed Contentful entry fetching requires contentful.client in SDK config.')
    }

    return contentful
  }

  private async scheduleSingleEntryFetch(
    client: ContentfulEntryClient,
    entryId: string,
    query: ContentfulEntryQuery,
    now: number,
  ): Promise<Entry> {
    const queryKey = getOptimizedEntrySourceKey('', query)
    let batch = this.pendingSingleBatches.get(queryKey)

    if (batch === undefined) {
      batch = {
        client,
        entryIds: [],
        promisesById: new Map<string, Promise<Entry>>(),
        query,
      }
      this.pendingSingleBatches.set(queryKey, batch)
    }

    const pending = batch.promisesById.get(entryId)

    if (pending !== undefined) return await pending

    batch.entryIds.push(entryId)
    const promise = this.cacheContentfulEntryPromise(
      getOptimizedEntrySourceKey(entryId, query),
      Promise.resolve().then(async () =>
        getFetchedContentfulEntry(await this.flushPendingSingleBatch(batch), entryId),
      ),
      now,
    )
    batch.promisesById.set(entryId, promise)

    return await promise
  }

  private async flushPendingSingleBatch(
    batch: PendingSingleEntryBatch,
  ): Promise<ReadonlyMap<string, Entry>> {
    if (batch.flushPromise !== undefined) return await batch.flushPromise

    this.pendingSingleBatches.delete(getOptimizedEntrySourceKey('', batch.query))

    const { client, query } = batch
    const entryIds = [...batch.entryIds]

    if (entryIds.length > 1) {
      batch.flushPromise = fetchContentfulEntryBatch(client.getEntries, query, entryIds)
      return await batch.flushPromise
    }

    const [entryId] = entryIds
    if (entryId === undefined) throw new Error('Managed Contentful entry batch was empty.')
    batch.flushPromise = client
      .getEntry(entryId, query)
      .then((entry) => new Map([[entryId, entry]]))
    return await batch.flushPromise
  }

  private getCachedContentfulEntry(cacheKey: string, now: number): Promise<Entry> | undefined {
    const cached = this.entryCache.get(cacheKey)

    if (cached === undefined) {
      return undefined
    }

    const [expiresAt, promise] = cached

    if (expiresAt > now) {
      this.entryCache.delete(cacheKey)
      this.entryCache.set(cacheKey, cached)
      return promise
    }

    this.entryCache.delete(cacheKey)
    return undefined
  }

  private setCachedContentfulEntry(
    cacheKey: string,
    promise: Promise<Entry>,
    now: number,
  ): ContentfulEntryCacheRecord | undefined {
    const { entryCacheOptions: cacheOptions } = this

    if (cacheOptions === undefined) {
      return
    }

    const [maxEntries, ttlMs] = cacheOptions
    const cacheRecord: ContentfulEntryCacheRecord = [now + ttlMs, promise]
    this.entryCache.set(cacheKey, cacheRecord)
    evictEntryCache(this.entryCache, maxEntries)
    return cacheRecord
  }

  private async cacheContentfulEntryPromise(
    cacheKey: string,
    promise: Promise<Entry>,
    now: number,
  ): Promise<Entry> {
    const cacheRecord = this.setCachedContentfulEntry(cacheKey, promise, now)

    if (cacheRecord !== undefined) {
      void promise.catch(() => {
        if (this.entryCache.get(cacheKey) === cacheRecord) {
          this.entryCache.delete(cacheKey)
        }
      })
    }

    return await promise
  }
}
