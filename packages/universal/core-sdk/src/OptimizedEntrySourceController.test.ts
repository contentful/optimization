import type { Entry } from 'contentful'
import type { ContentfulEntryQuery } from './CoreBase'
import { OptimizedEntrySourceController } from './OptimizedEntrySourceController'

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
    const baselineEntry = createTestEntry('baseline')
    const sdk = createSdk(async () => await Promise.resolve(createTestEntry('managed')))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({
      baselineEntry,
      entryId: 'managed',
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
    const baselineEntry = createTestEntry('baseline')
    const sdk = createSdk(async () => await Promise.resolve(baselineEntry))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({
      entryId: 'baseline',
      entryQuery: { locale: 'de-DE' },
      sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toEqual({
      entryId: 'baseline',
      isLoading: true,
    })
    await flushMicrotasks()

    expect(sdk.fetchContentfulEntry).toHaveBeenCalledWith('baseline', { locale: 'de-DE' })
    expect(controller.getSnapshot()).toEqual({
      baselineEntry,
      entryId: 'baseline',
      isLoading: false,
    })
  })

  it('stays loading without fetching until the SDK is ready', () => {
    const sdk = createSdk(async () => await Promise.resolve(createTestEntry('baseline')))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: 'baseline' })

    expect(controller.getSnapshot()).toEqual({
      entryId: 'baseline',
      isLoading: true,
    })
    expect(sdk.fetchContentfulEntry).not.toHaveBeenCalled()

    controller.updateOptions({ entryId: 'baseline', sdk, isSdkStateReady: false })

    expect(controller.getSnapshot()).toEqual({
      entryId: 'baseline',
      isLoading: true,
    })
    expect(sdk.fetchContentfulEntry).not.toHaveBeenCalled()
  })

  it('ignores stale fetches after source changes or disconnects', async () => {
    const firstEntry = createTestEntry('first')
    const secondEntry = createTestEntry('second')
    const thirdEntry = createTestEntry('third')
    const firstFetch = createDeferred<Entry>()
    const secondFetch = createDeferred<Entry>()
    const thirdFetch = createDeferred<Entry>()
    const sdk = createSdk(async (entryId) => {
      if (entryId === 'first') return await firstFetch.promise
      if (entryId === 'second') return await secondFetch.promise
      return await thirdFetch.promise
    })
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: 'first', sdk, isSdkStateReady: true })
    controller.updateOptions({ entryId: 'second', sdk, isSdkStateReady: true })

    secondFetch.resolve(secondEntry)
    await flushMicrotasks()
    expect(controller.getSnapshot().baselineEntry).toBe(secondEntry)

    firstFetch.resolve(firstEntry)
    await flushMicrotasks()
    expect(controller.getSnapshot().baselineEntry).toBe(secondEntry)

    controller.updateOptions({ entryId: 'third', sdk, isSdkStateReady: true })
    controller.disconnect()
    thirdFetch.resolve(thirdEntry)
    await flushMicrotasks()

    expect(controller.getSnapshot()).toEqual({
      entryId: 'third',
      isLoading: true,
    })
  })

  it('surfaces failed fetches as Error snapshots', async () => {
    const sdk = createSdk(async () => await Promise.reject(new Error('CDA failed')))
    const controller = new OptimizedEntrySourceController()

    controller.updateOptions({ entryId: 'baseline', sdk, isSdkStateReady: true })
    await flushMicrotasks()

    expect(controller.getSnapshot().error).toBeInstanceOf(Error)
    expect(controller.getSnapshot().error?.message).toBe('CDA failed')
    expect(controller.getSnapshot()).toMatchObject({
      entryId: 'baseline',
      isLoading: false,
    })
  })
})
