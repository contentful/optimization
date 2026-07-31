import type { Entry } from 'contentful'
import type { ContentfulEntryQuery } from './CoreBase'
import {
  getOptimizedEntrySourceKey,
  OptimizedEntrySourceController,
  prefetchManagedEntries,
} from './OptimizedEntrySourceController'

function createTestEntry(id: string): Entry {
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function createSdk(
  fetchContentfulEntry: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>,
): {
  readonly fetchContentfulEntry: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
} {
  return { fetchContentfulEntry: rs.fn(fetchContentfulEntry) }
}

describe('OptimizedEntrySourceController', () => {
  it('lets baselineEntry take precedence over entryId without fetching', () => {
    const baselineEntry = createTestEntry('4ib0hsHWoSOnCVdDkizE8d')
    const sdk = createSdk(
      async () => await Promise.resolve(createTestEntry('5mN8rY2pL6qT9vW3xA4bCd')),
    )
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({
      baselineEntry,
      entryId: '5mN8rY2pL6qT9vW3xA4bCd',
      sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toEqual({
      baselineEntry,
      isLoading: false,
    })
    expect(sdk.fetchContentfulEntry).not.toHaveBeenCalled()
  })

  it('fetches managed entryId entries with query options', async () => {
    const baselineEntry = createTestEntry('4ib0hsHWoSOnCVdDkizE8d')
    const sdk = createSdk(async () => await Promise.resolve(baselineEntry))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      entryQuery: { locale: 'de-DE' },
      sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toEqual({
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      isLoading: true,
    })
    await flushMicrotasks()

    expect(sdk.fetchContentfulEntry).toHaveBeenCalledWith('4ib0hsHWoSOnCVdDkizE8d', {
      locale: 'de-DE',
    })
    expect(controller.getSnapshot()).toEqual({
      baselineEntry,
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      isLoading: false,
    })
  })

  it('creates stable managed source keys for equivalent query objects', () => {
    expect(
      getOptimizedEntrySourceKey('4ib0hsHWoSOnCVdDkizE8d', { locale: 'de-DE', include: 2 }),
    ).toBe(getOptimizedEntrySourceKey('4ib0hsHWoSOnCVdDkizE8d', { include: 2, locale: 'de-DE' }))
  })

  it('stays loading without fetching until the SDK is ready', () => {
    const sdk = createSdk(
      async () => await Promise.resolve(createTestEntry('4ib0hsHWoSOnCVdDkizE8d')),
    )
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: '4ib0hsHWoSOnCVdDkizE8d' })

    expect(controller.getSnapshot()).toEqual({
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      isLoading: true,
    })
    expect(sdk.fetchContentfulEntry).not.toHaveBeenCalled()

    controller.updateOptions({ entryId: '4ib0hsHWoSOnCVdDkizE8d', sdk, isSdkStateReady: false })

    expect(controller.getSnapshot()).toEqual({
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      isLoading: true,
    })
    expect(sdk.fetchContentfulEntry).not.toHaveBeenCalled()
  })

  it('ignores stale fetches after source changes or disconnects', async () => {
    const firstEntry = createTestEntry('3Z2hP4vR8sT1nY6mK9qL0a')
    const secondEntry = createTestEntry('5mN8rY2pL6qT9vW3xA4bCd')
    const thirdEntry = createTestEntry('7pQ2rS5tU8vW1xY4zA6bCd')
    const firstFetch = createDeferred<Entry>()
    const secondFetch = createDeferred<Entry>()
    const thirdFetch = createDeferred<Entry>()
    const sdk = createSdk(async (entryId) => {
      if (entryId === '3Z2hP4vR8sT1nY6mK9qL0a') return await firstFetch.promise
      if (entryId === '5mN8rY2pL6qT9vW3xA4bCd') return await secondFetch.promise
      return await thirdFetch.promise
    })
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: '3Z2hP4vR8sT1nY6mK9qL0a', sdk, isSdkStateReady: true })
    controller.updateOptions({ entryId: '5mN8rY2pL6qT9vW3xA4bCd', sdk, isSdkStateReady: true })

    secondFetch.resolve(secondEntry)
    await flushMicrotasks()
    expect(controller.getSnapshot().baselineEntry).toBe(secondEntry)

    firstFetch.resolve(firstEntry)
    await flushMicrotasks()
    expect(controller.getSnapshot().baselineEntry).toBe(secondEntry)

    controller.updateOptions({ entryId: '7pQ2rS5tU8vW1xY4zA6bCd', sdk, isSdkStateReady: true })
    controller.disconnect()
    thirdFetch.resolve(thirdEntry)
    await flushMicrotasks()

    expect(controller.getSnapshot()).toEqual({
      entryId: '7pQ2rS5tU8vW1xY4zA6bCd',
      isLoading: true,
    })
  })

  it('surfaces failed fetches as Error snapshots', async () => {
    const sdk = createSdk(async () => await Promise.reject(new Error('CDA failed')))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: '4ib0hsHWoSOnCVdDkizE8d', sdk, isSdkStateReady: true })
    await flushMicrotasks()

    expect(controller.getSnapshot().error).toBeInstanceOf(Error)
    expect(controller.getSnapshot().error?.message).toBe('CDA failed')
    expect(controller.getSnapshot()).toMatchObject({
      entryId: '4ib0hsHWoSOnCVdDkizE8d',
      isLoading: false,
    })
  })
})

describe('prefetchManagedEntries', () => {
  it('delegates prefetching to the managed-entry runtime', async () => {
    const runtime = {
      prefetchManagedEntries: rs.fn(
        async () =>
          await Promise.resolve([
            {
              baselineEntry: createTestEntry('4ib0hsHWoSOnCVdDkizE8d'),
              entryId: '4ib0hsHWoSOnCVdDkizE8d',
            },
          ]),
      ),
    }

    const entries = await prefetchManagedEntries(runtime, ['4ib0hsHWoSOnCVdDkizE8d'])

    expect(runtime.prefetchManagedEntries).toHaveBeenCalledWith(['4ib0hsHWoSOnCVdDkizE8d'])
    expect(entries).toEqual([
      {
        baselineEntry: createTestEntry('4ib0hsHWoSOnCVdDkizE8d'),
        entryId: '4ib0hsHWoSOnCVdDkizE8d',
      },
    ])
  })
})
