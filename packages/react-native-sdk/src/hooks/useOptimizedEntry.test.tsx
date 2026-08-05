import type { EntryFor, OptimizedEntryMetadata, ResolvedData } from '@contentful/optimization-core'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import React, { act } from 'react'
import type { OptimizedEntry as OptimizedEntryComponent } from '../components/OptimizedEntry'
import { loadTestRenderer } from '../test/testRenderer'
import type { UseEntryResolverResult } from './useEntryResolver'
import {
  useOptimizedEntry,
  type UseOptimizedEntryParams,
  type UseOptimizedEntryResult,
} from './useOptimizedEntry'
import type { UseTapTrackingOptions } from './useTapTracking'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type PossibleSkeleton = PageSkeleton | HeroSkeleton
type Modifier = 'WITHOUT_LINK_RESOLUTION'
type Locale = 'en-US'

function assertOptimizedEntryTypes(
  OptimizedEntry: typeof OptimizedEntryComponent,
  resolver: UseEntryResolverResult,
  baselineEntry: Entry<PageSkeleton, Modifier, Locale>,
): void {
  const inferred: UseOptimizedEntryResult<Entry<PageSkeleton, Modifier, Locale>> =
    useOptimizedEntry({ baselineEntry })
  const result: UseOptimizedEntryResult<EntryFor<PossibleSkeleton, Modifier, Locale>> =
    useOptimizedEntry<PossibleSkeleton, Modifier, Locale>({ baselineEntry })
  const metadata: OptimizedEntryMetadata<PossibleSkeleton, Modifier, Locale> | undefined =
    result.metadata
  const helperEntry: EntryFor<PossibleSkeleton, Modifier, Locale> = resolver.resolveEntry<
    PossibleSkeleton,
    Modifier,
    Locale
  >(baselineEntry)
  const helperData: ResolvedData<PossibleSkeleton, Modifier, Locale> = resolver.resolveEntryData<
    PossibleSkeleton,
    Modifier,
    Locale
  >(baselineEntry)
  const managed: UseOptimizedEntryResult<
    EntryFor<PossibleSkeleton, undefined, Locale> | undefined
  > = useOptimizedEntry<PossibleSkeleton, Locale>({ entryId: 'page' })
  const tapOptions: UseTapTrackingOptions<typeof result.entry> = {
    enabled: true,
    entry: result.entry,
    onTap(entry) {
      const resolved: EntryFor<PossibleSkeleton, Modifier, Locale> = entry
      void resolved
    },
  }
  OptimizedEntry<PossibleSkeleton, Modifier, Locale>({
    baselineEntry,
    children: (entry) => entry.sys.id,
    onTap: (entry) => entry.sys.id,
  })
  void inferred
  void metadata
  void helperEntry
  void helperData
  void managed
  void tapOptions
}

void assertOptimizedEntryTypes

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const selectedOptimizations = {
  current: undefined,
  subscribe: rs.fn(() => ({ unsubscribe: rs.fn() })),
}
const fetchContentfulEntry = rs.fn(
  async (entryId: string) => await Promise.resolve(createEntry(entryId)),
)
const resolveOptimizedEntry = rs.fn((entry: Entry): ResolvedData<EntrySkeletonType> => ({ entry }))
const optimization = {
  fetchContentfulEntry,
  resolveOptimizedEntry,
  states: {
    selectedOptimizations,
  },
}

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => optimization,
}))

interface TestRenderer {
  unmount: () => void
}

function createEntry(id: string): Entry {
  return {
    sys: {
      id,
      type: 'Entry',
      contentType: { sys: { id: 'testType', type: 'Link', linkType: 'ContentType' } },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      environment: { sys: { id: 'master', type: 'Link', linkType: 'Environment' } },
      publishedVersion: 1,
      space: { sys: { id: 'space1', type: 'Link', linkType: 'Space' } },
      revision: 1,
      locale: 'en-US',
    },
    fields: { title: id },
    metadata: { concepts: [], tags: [] },
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

async function renderHook(
  params: UseOptimizedEntryParams,
): Promise<{ getResult: () => UseOptimizedEntryResult; unmount: () => void }> {
  const testRenderer = await loadTestRenderer<TestRenderer>()
  let captured: UseOptimizedEntryResult | undefined = undefined
  let renderer: TestRenderer | undefined = undefined

  function Probe(): null {
    captured = useOptimizedEntry(params)
    return null
  }

  act(() => {
    renderer = testRenderer.create(<Probe />)
  })

  return {
    getResult() {
      if (captured === undefined) {
        throw new Error('Expected hook result to be captured')
      }

      return captured
    },
    unmount() {
      renderer?.unmount()
    },
  }
}

describe('useOptimizedEntry', () => {
  let unmount: (() => void) | undefined = undefined

  beforeEach(() => {
    rs.clearAllMocks()
    selectedOptimizations.current = undefined
    fetchContentfulEntry.mockImplementation(
      async (entryId: string) => await Promise.resolve(createEntry(entryId)),
    )
    resolveOptimizedEntry.mockImplementation(
      (entry: Entry): ResolvedData<EntrySkeletonType> => ({
        entry,
      }),
    )
  })

  afterEach(() => {
    if (unmount) {
      act(() => {
        unmount?.()
      })
      unmount = undefined
    }
  })

  it('returns manual baseline entries synchronously', async () => {
    const baselineEntry = createEntry('baseline')
    const rendered = await renderHook({ baselineEntry })
    unmount = rendered.unmount

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      baselineEntry,
      error: undefined,
      isLoading: false,
      isPresentationReady: true,
    })
    expect(rendered.getResult()).not.toHaveProperty('isReady')
  })

  it('fetches managed entryId entries with query options', async () => {
    const baselineEntry = createEntry('baseline')
    const deferred = createDeferred<Entry>()
    const onEntryResolved = rs.fn()
    fetchContentfulEntry.mockImplementation(async () => await deferred.promise)
    const rendered = await renderHook({
      entryId: 'baseline',
      entryQuery: { locale: 'de-DE' },
      onEntryResolved,
    })
    unmount = rendered.unmount

    expect(rendered.getResult()).toMatchObject({
      entry: undefined,
      baselineEntry: undefined,
      isLoading: true,
      isPresentationReady: false,
    })
    expect(fetchContentfulEntry).toHaveBeenCalledWith('baseline', { locale: 'de-DE' })

    await act(async () => {
      deferred.resolve(baselineEntry)
      await deferred.promise
    })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      baselineEntry,
      error: undefined,
      isLoading: false,
      isPresentationReady: true,
      isResolved: true,
      metadata: {
        baselineEntry,
        baselineEntryId: 'baseline',
        entry: baselineEntry,
        entryId: 'baseline',
      },
    })
    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntry,
        entry: baselineEntry,
      }),
    )
  })

  it('surfaces managed entryId fetch errors once', async () => {
    const error = new Error('CDA failed')
    const onEntryError = rs.fn()
    fetchContentfulEntry.mockImplementation(async () => await Promise.reject(error))
    const rendered = await renderHook({ entryId: 'baseline', onEntryError })
    unmount = rendered.unmount

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onEntryError).toHaveBeenCalledTimes(1)
    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(rendered.getResult()).toMatchObject({
      entry: undefined,
      baselineEntry: undefined,
      error,
      isLoading: false,
      isPresentationReady: false,
    })
  })
})
