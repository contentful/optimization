import type { ApiClientConfig } from '@contentful/optimization-api-client'
import { EXPERIENCE_BASE_URL } from '@contentful/optimization-api-client'
import { createClient, type Entry, type EntryFieldTypes, type EntrySkeletonType } from 'contentful'
import type { ChangeArray } from './api-schemas'
import { OPTIMIZATION_CORE_SDK_NAME } from './constants'
import CoreBase, {
  type ContentfulEntryClient,
  type ContentfulEntryQuery,
  type CoreConfig,
} from './CoreBase'
import { FlagsResolver } from './resolvers'
import { optimizedEntry } from './test/fixtures/optimizedEntry'
import { selectedOptimizations } from './test/fixtures/selectedOptimizations'

class TestCore extends CoreBase {
  constructor(
    config: CoreConfig,
    api: Pick<ApiClientConfig, 'experience' | 'insights'> = {},
    locale?: string,
  ) {
    super(config, api, locale)
  }

  setLocale(locale: string | undefined): void {
    this.setResolvedLocale(locale)
  }
}

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

type MockContentfulGetEntry = (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
type MockContentfulGetEntries = (
  query?: Parameters<ContentfulEntryClient['getEntries']>[0],
) => ReturnType<ContentfulEntryClient['getEntries']>
type ProductEntrySkeleton = EntrySkeletonType<
  {
    title: EntryFieldTypes.Symbol
  },
  'product'
>
const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const CHANGES: ChangeArray = [
  {
    key: 'dark-mode',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 0,
    },
  },
  {
    key: 'price',
    type: 'Variable',
    value: {
      value: {
        amount: 10,
        currency: 'USD',
      },
    },
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

function createEntry(id: string): Entry {
  return {
    fields: { title: id },
    metadata: { tags: [] },
    sys: {
      contentType: { sys: { id: 'test-content-type', linkType: 'ContentType', type: 'Link' } },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: { sys: { id: 'main', linkType: 'Environment', type: 'Link' } },
      id,
      publishedVersion: 1,
      revision: 1,
      space: { sys: { id: 'space-id', linkType: 'Space', type: 'Link' } },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

function createContentfulClient(
  implementation: MockContentfulGetEntry = async (entryId) =>
    await Promise.resolve(createEntry(entryId)),
  getEntriesImplementation: MockContentfulGetEntries = async (query) =>
    await Promise.resolve(createEntryCollection(getRequestedEntryIds(query).map(createEntry))),
): ContentfulEntryClient & {
  readonly getEntry: ReturnType<typeof rs.fn<MockContentfulGetEntry>>
  readonly getEntries: ReturnType<typeof rs.fn<MockContentfulGetEntries>>
} {
  const getEntry = rs.fn<MockContentfulGetEntry>(implementation)
  const getEntries = rs.fn<MockContentfulGetEntries>(getEntriesImplementation)
  const client: ContentfulEntryClient & {
    readonly getEntry: ReturnType<typeof rs.fn<MockContentfulGetEntry>>
    readonly getEntries: ReturnType<typeof rs.fn<MockContentfulGetEntries>>
  } = {
    getEntry,
    getEntries,
  }

  return client
}

function getRequestedEntryIds(query: Parameters<MockContentfulGetEntries>[0]): string[] {
  const requestedIds = Reflect.get(query ?? {}, 'sys.id[in]')
  return Array.isArray(requestedIds) ? requestedIds.map(String) : String(requestedIds).split(',')
}

function createEntryCollection(
  items: readonly Entry[],
): Awaited<ReturnType<ContentfulEntryClient['getEntries']>> {
  return {
    items: [...items],
    limit: items.length,
    skip: 0,
    total: items.length,
  }
}

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: T) => void
} {
  let resolveDeferred: (value: T) => void = () => undefined
  let rejectDeferred: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

describe('CoreBase', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    rs.useRealTimers()
  })

  it('allows access to the original configuration options', () => {
    const core = new TestCore(config)

    expect(core.config).toEqual(config)
    expect(core.eventBuilder.library.name).toEqual(OPTIMIZATION_CORE_SDK_NAME)
  })

  it('keeps Insights API and Experience API client config isolated', () => {
    const core = new TestCore(
      {
        clientId: CLIENT_ID,
      },
      {
        insights: {
          baseUrl: 'https://ingest.example.test/',
        },
        experience: {
          baseUrl: 'https://experience.example.test/',
        },
      },
    )

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe('https://experience.example.test/')
  })

  it('falls back to default base URLs when only one side is configured', () => {
    const core = new TestCore(
      {
        clientId: CLIENT_ID,
      },
      {
        insights: { baseUrl: 'https://ingest.example.test/' },
      },
    )

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe(EXPERIENCE_BASE_URL)
  })

  it('forwards top-level fetch options to the shared api config', () => {
    const fetchOptions = { requestTimeout: 9_000 }
    const core = new TestCore({
      clientId: CLIENT_ID,
      fetchOptions,
    })

    expect(core.api.config.fetchOptions).toEqual(fetchOptions)
  })

  it('exposes flagsResolver for advanced custom-flag resolution use cases', () => {
    const core = new TestCore(config)

    expect(core.flagsResolver).toBe(FlagsResolver)
  })

  it('resolves custom flags by key without auto-tracking in non-stateful environments', () => {
    const core = new TestCore(config)

    expect(core.getFlag('dark-mode', CHANGES)).toBe(true)
    expect(core.getFlag('price', CHANGES)).toEqual({
      amount: 10,
      currency: 'USD',
    })
  })

  it('exposes the SDK Experience API/event locale through locale', () => {
    const core = new TestCore(config, {}, 'de-DE')

    expect(core.locale).toBe('de-DE')
  })

  it('uses the live SDK locale as the default event locale', () => {
    const core = new TestCore(config, {}, 'en-US')

    core.setLocale('de-DE')

    expect(core.eventBuilder.buildPageView({}).context.locale).toBe('de-DE')
  })

  it('accepts normal contentful.js clients for managed entry fetching config', () => {
    const normalContentfulClient = createClient({
      accessToken: 'delivery-token',
      space: 'space-id',
    })
    const typedClient: ContentfulEntryClient = normalContentfulClient

    const core = new TestCore({
      ...config,
      contentful: { client: typedClient, cache: false },
    })

    expect(core.config.contentful?.client).toBe(normalContentfulClient)
  })

  it('preserves managed Contentful entry skeleton types for fetched entries', async () => {
    const client = createContentfulClient()
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    const entry = await core.fetchContentfulEntry<ProductEntrySkeleton>('entry-id')
    const result = await core.fetchOptimizedEntry<ProductEntrySkeleton>('entry-id')
    const typedEntry: Entry<ProductEntrySkeleton, undefined> = entry
    const typedBaselineEntry: Entry<ProductEntrySkeleton, undefined> = result.baselineEntry
    const typedResolvedEntry: Entry<ProductEntrySkeleton, undefined> = result.entry
    const typedTitle: string = result.entry.fields.title

    expect(typedEntry).toBe(entry)
    expect(typedBaselineEntry).toBe(result.baselineEntry)
    expect(typedResolvedEntry).toBe(result.entry)
    expect(typedTitle).toBe(result.entry.fields.title)
  })

  it('merges Contentful entry query defaults, SDK locale, include depth, and per-call overrides', async () => {
    const client = createContentfulClient()
    const core = new TestCore(
      {
        ...config,
        contentful: {
          client,
          defaultQuery: { include: 2, locale: 'en-US' },
          cache: false,
        },
      },
      {},
      'de-DE',
    )

    await core.fetchContentfulEntry('entry-a', { locale: 'fr-FR' })
    await core.fetchContentfulEntry('entry-b', { include: 1 })

    expect(client.getEntry).toHaveBeenNthCalledWith(1, 'entry-a', {
      include: 2,
      locale: 'fr-FR',
    })
    expect(client.getEntry).toHaveBeenNthCalledWith(2, 'entry-b', {
      include: 1,
      locale: 'en-US',
    })
  })

  it('uses SDK locale and include 10 when Contentful entry query omits them', async () => {
    const client = createContentfulClient()
    const core = new TestCore(
      {
        ...config,
        contentful: { client, cache: false },
      },
      {},
      'de-DE',
    )

    await core.fetchContentfulEntry('entry-id')

    expect(client.getEntry).toHaveBeenCalledWith('entry-id', {
      include: 10,
      locale: 'de-DE',
    })
  })

  it('caches equivalent Contentful entry queries regardless of key insertion order', async () => {
    const client = createContentfulClient()
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    await core.fetchContentfulEntry('entry-id', { locale: 'de-DE', include: 1 })
    await core.fetchContentfulEntry('entry-id', { include: 1, locale: 'de-DE' })

    expect(client.getEntry).toHaveBeenCalledTimes(1)
  })

  it('fetches one uncached descriptor with getEntry', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async () => await Promise.resolve(createEntryCollection([])),
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    await expect(core.fetchContentfulEntries(['entry-a'])).resolves.toMatchObject([
      { sys: { id: 'entry-a' } },
    ])

    expect(client.getEntry).toHaveBeenCalledWith('entry-a', { include: 10 })
    expect(client.getEntries).not.toHaveBeenCalled()
  })

  it('coalesces same-tick uncached single-entry fetches through getEntries', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore(
      {
        ...config,
        contentful: { client, cache: false },
      },
      {},
      'de-DE',
    )

    const first = core.fetchContentfulEntry('entry-a')
    const second = core.fetchContentfulEntry('entry-b')

    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { sys: { id: 'entry-a' } },
      { sys: { id: 'entry-b' } },
    ])

    expect(client.getEntry).not.toHaveBeenCalled()
    expect(client.getEntries).toHaveBeenCalledWith({
      include: 10,
      locale: 'de-DE',
      'sys.id[in]': ['entry-a', 'entry-b'],
      limit: 2,
    })
  })

  it('batches string and object descriptors with the same normalized query through getEntries', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    await expect(
      core.fetchContentfulEntries(['entry-a', { entryId: 'entry-b' }]),
    ).resolves.toMatchObject([{ sys: { id: 'entry-a' } }, { sys: { id: 'entry-b' } }])

    expect(client.getEntry).not.toHaveBeenCalled()
    expect(client.getEntries).toHaveBeenCalledWith({
      include: 10,
      'sys.id[in]': ['entry-a', 'entry-b'],
      limit: 2,
    })
  })

  it('batches equivalent entryQuery objects regardless of key insertion order', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    await core.fetchContentfulEntries([
      { entryId: 'entry-a', entryQuery: { locale: 'de-DE', include: 2 } },
      { entryId: 'entry-b', entryQuery: { include: 2, locale: 'de-DE' } },
    ])

    expect(client.getEntry).not.toHaveBeenCalled()
    expect(client.getEntries).toHaveBeenCalledTimes(1)
    expect(client.getEntries).toHaveBeenCalledWith({
      locale: 'de-DE',
      include: 2,
      'sys.id[in]': ['entry-a', 'entry-b'],
      limit: 2,
    })
  })

  it('creates separate batches for different entryQuery and locale groups', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore(
      {
        ...config,
        contentful: { client, cache: false },
      },
      {},
      'de-DE',
    )

    await core.fetchContentfulEntries([
      'entry-a',
      'entry-b',
      { entryId: 'entry-c', entryQuery: { locale: 'fr-FR' } },
      { entryId: 'entry-d', entryQuery: { locale: 'fr-FR' } },
    ])

    expect(client.getEntries).toHaveBeenNthCalledWith(1, {
      include: 10,
      locale: 'de-DE',
      'sys.id[in]': ['entry-a', 'entry-b'],
      limit: 2,
    })
    expect(client.getEntries).toHaveBeenNthCalledWith(2, {
      include: 10,
      locale: 'fr-FR',
      'sys.id[in]': ['entry-c', 'entry-d'],
      limit: 2,
    })
    expect(client.getEntry).not.toHaveBeenCalled()
  })

  it('uses cached entries for plural fetches', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    await core.fetchContentfulEntries(['entry-a', 'entry-b'])
    await core.fetchContentfulEntries(['entry-b', 'entry-a'])

    expect(client.getEntries).toHaveBeenCalledTimes(1)
    expect(client.getEntry).not.toHaveBeenCalled()
  })

  it('reuses in-flight batch entries for concurrent plural fetches', async () => {
    const deferred = createDeferred<Awaited<ReturnType<ContentfulEntryClient['getEntries']>>>()
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async () => await deferred.promise,
    )
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    const first = core.fetchContentfulEntries(['entry-a', 'entry-b'])
    const second = core.fetchContentfulEntries(['entry-b', 'entry-a'])

    expect(client.getEntries).toHaveBeenCalledTimes(1)

    deferred.resolve(createEntryCollection([createEntry('entry-a'), createEntry('entry-b')]))

    await expect(first).resolves.toMatchObject([
      { sys: { id: 'entry-a' } },
      { sys: { id: 'entry-b' } },
    ])
    await expect(second).resolves.toMatchObject([
      { sys: { id: 'entry-b' } },
      { sys: { id: 'entry-a' } },
    ])
    expect(client.getEntry).not.toHaveBeenCalled()
  })

  it('preserves duplicate descriptor order while fetching each uncached entry once', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    const entries = await core.fetchContentfulEntries(['entry-a', 'entry-b', 'entry-a'])

    expect(entries.map((entry) => entry.sys.id)).toEqual(['entry-a', 'entry-b', 'entry-a'])
    expect(client.getEntries).toHaveBeenCalledWith({
      include: 10,
      'sys.id[in]': ['entry-a', 'entry-b'],
      limit: 2,
    })
    expect(client.getEntry).not.toHaveBeenCalled()
  })

  it('chunks getEntries managed entry batches at 100 IDs', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })
    const entryIds = Array.from({ length: 205 }, (_, index) => `entry-${index}`)

    const entries = await core.fetchContentfulEntries(entryIds)
    const { getEntries } = client

    expect(entries.map((entry) => entry.sys.id)).toEqual(entryIds)
    expect(getEntries).toHaveBeenCalledTimes(3)
    expect(getEntries.mock.calls.map(([query]) => getRequestedEntryIds(query).length)).toEqual([
      100, 100, 5,
    ])
    expect(getEntries.mock.calls[0]?.[0]).toMatchObject({
      include: 10,
      'sys.id[in]': entryIds.slice(0, 100),
      limit: 100,
    })
    expect(getEntries.mock.calls[2]?.[0]).toMatchObject({
      include: 10,
      'sys.id[in]': entryIds.slice(200),
      limit: 5,
    })
  })

  it('rejects cleanly when getEntries omits a requested entry', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async () => await Promise.resolve(createEntryCollection([createEntry('entry-a')])),
    )
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    await expect(core.fetchContentfulEntries(['entry-a', 'entry-b'])).rejects.toThrow(
      'Contentful getEntries() response did not include entry "entry-b".',
    )
    await expect(core.fetchContentfulEntry('entry-a')).resolves.toMatchObject({
      sys: { id: 'entry-a' },
    })

    expect(client.getEntries).toHaveBeenCalledTimes(1)
    expect(client.getEntry).toHaveBeenCalledTimes(1)
  })

  it('returns managed-entry handoffs from prefetchManagedEntries', async () => {
    const client = createContentfulClient(
      async (entryId) => await Promise.resolve(createEntry(entryId)),
      async (query) => {
        const ids = getRequestedEntryIds(query)
        return await Promise.resolve(createEntryCollection(ids.map(createEntry)))
      },
    )
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    await expect(
      core.prefetchManagedEntries([
        'entry-a',
        { entryId: 'entry-b', entryQuery: { locale: 'de-DE' } },
      ]),
    ).resolves.toEqual([
      {
        baselineEntry: createEntry('entry-a'),
        entryId: 'entry-a',
      },
      {
        baselineEntry: createEntry('entry-b'),
        entryId: 'entry-b',
        entryQuery: { locale: 'de-DE' },
      },
    ])
  })

  it('throws when managed Contentful fetching is used without a client', async () => {
    const core = new TestCore(config)

    await expect(core.fetchContentfulEntry('entry-id')).rejects.toThrow(
      'Managed Contentful entry fetching requires contentful.client in SDK config.',
    )
  })

  it('caches Contentful entries and in-flight requests by entry ID and merged query', async () => {
    const deferred = createDeferred<Entry>()
    const client = createContentfulClient(async () => await deferred.promise)
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    const first = core.fetchContentfulEntry('entry-id')
    const second = core.fetchContentfulEntry('entry-id')

    await Promise.resolve()

    expect(client.getEntry).toHaveBeenCalledTimes(1)

    const entry = createEntry('entry-id')
    deferred.resolve(entry)

    await expect(first).resolves.toBe(entry)
    await expect(second).resolves.toBe(entry)
    await expect(core.fetchContentfulEntry('entry-id')).resolves.toBe(entry)
    expect(client.getEntry).toHaveBeenCalledTimes(1)
  })

  it('expires cached Contentful entries by TTL', async () => {
    rs.useFakeTimers()
    rs.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const client = createContentfulClient()
    const core = new TestCore({
      ...config,
      contentful: { client, cache: { ttlMs: 1000 } },
    })

    await core.fetchContentfulEntry('entry-id')
    rs.setSystemTime(new Date('2026-01-01T00:00:00.999Z'))
    await core.fetchContentfulEntry('entry-id')
    rs.setSystemTime(new Date('2026-01-01T00:00:01.001Z'))
    await core.fetchContentfulEntry('entry-id')

    expect(client.getEntry).toHaveBeenCalledTimes(2)
  })

  it('evicts least-recently-used Contentful entries when the cache is full', async () => {
    const client = createContentfulClient()
    const core = new TestCore({
      ...config,
      contentful: { client, cache: { maxEntries: 2 } },
    })

    await core.fetchContentfulEntry('entry-a')
    await core.fetchContentfulEntry('entry-b')
    await core.fetchContentfulEntry('entry-a')
    await core.fetchContentfulEntry('entry-c')
    await core.fetchContentfulEntry('entry-b')

    expect(client.getEntry).toHaveBeenCalledTimes(4)
  })

  it('removes failed Contentful requests from the cache', async () => {
    const client = createContentfulClient()
    client.getEntry.mockRejectedValueOnce(new Error('CDA failed'))
    const core = new TestCore({
      ...config,
      contentful: { client },
    })

    await expect(core.fetchContentfulEntry('entry-id')).rejects.toThrow('CDA failed')
    await expect(core.fetchContentfulEntry('entry-id')).resolves.toMatchObject({
      sys: { id: 'entry-id' },
    })

    expect(client.getEntry).toHaveBeenCalledTimes(2)
  })

  it('can disable and clear the managed Contentful entry cache', async () => {
    const uncachedClient = createContentfulClient()
    const uncachedCore = new TestCore({
      ...config,
      contentful: { client: uncachedClient, cache: false },
    })

    await uncachedCore.fetchContentfulEntry('entry-id')
    await uncachedCore.fetchContentfulEntry('entry-id')
    expect(uncachedClient.getEntry).toHaveBeenCalledTimes(2)

    const cachedClient = createContentfulClient()
    const cachedCore = new TestCore({
      ...config,
      contentful: { client: cachedClient },
    })

    await cachedCore.fetchContentfulEntry('entry-id')
    cachedCore.clearContentfulEntryCache()
    await cachedCore.fetchContentfulEntry('entry-id')
    expect(cachedClient.getEntry).toHaveBeenCalledTimes(2)
  })

  it('fetches and resolves optimized Contentful entries with metadata', async () => {
    const client = createContentfulClient(async () => await Promise.resolve(optimizedEntry))
    const core = new TestCore({
      ...config,
      contentful: { client, cache: false },
    })

    const result = await core.fetchOptimizedEntry('entry-id', { selectedOptimizations })

    expect(result.baselineEntry).toBe(optimizedEntry)
    expect(result.entry.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    expect(result.selectedOptimization).toEqual(
      expect.objectContaining({
        experienceId: '2qVK4T5lnScbswoyBuGipd',
        variantIndex: 1,
      }),
    )
  })
})
