import type {
  ContentfulEntryQuery,
  ManagedEntryDescriptor,
  ResolvedData,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { act } from 'react'
import { loadTestRenderer } from '../test/testRenderer'
import { isRecord } from '../test/typeGuards'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let selectedOptimizationsListener:
  | ((selectedOptimizations: SelectedOptimizationArray | undefined) => void)
  | undefined
const selectedOptimizations = {
  current: undefined,
  subscribe: rs.fn(
    (listener: (selectedOptimizations: SelectedOptimizationArray | undefined) => void) => {
      selectedOptimizationsListener = listener
      return { unsubscribe: rs.fn() }
    },
  ),
}
const resolveOptimizedEntry = rs.fn((entry: Entry): ResolvedData<EntrySkeletonType> => ({ entry }))
const fetchContentfulEntry = rs.fn(
  async (descriptor: ManagedEntryDescriptor, _query?: ContentfulEntryQuery) =>
    await Promise.resolve(createEntry(resolveDescriptorId(descriptor))),
)
const optimization = {
  fetchContentfulEntry,
  resolveOptimizedEntry,
  states: {
    selectedOptimizations,
  },
}
const useViewportTracking = rs.fn((_options: Record<string, unknown>) => ({
  isVisible: false,
  onLayout: rs.fn(),
}))
const useTapTracking = rs.fn((_options: Record<string, unknown>) => ({
  onTouchEnd: undefined,
  onTouchStart: undefined,
}))

rs.mock('react-native', () => ({
  View: 'View',
}))

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => optimization,
}))

rs.mock('../hooks/useViewportTracking', () => ({
  useViewportTracking,
}))

rs.mock('../hooks/useTapTracking', () => ({
  useTapTracking,
}))

interface TestRenderer {
  toJSON: () => unknown
  unmount: () => void
}

function resolveDescriptorId(descriptor: ManagedEntryDescriptor): string {
  if (typeof descriptor === 'string') return descriptor
  return descriptor.entryId ?? descriptor.slug
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

function getCallOptions(
  mock: typeof useViewportTracking | typeof useTapTracking,
): Record<string, unknown> {
  const {
    mock: {
      calls: [call],
    },
  } = mock

  if (call === undefined) {
    throw new Error('Expected hook to be called')
  }

  const [firstArg] = call
  const options: unknown = firstArg

  if (!isRecord(options)) {
    throw new Error('Expected hook options to be captured')
  }

  return options
}

describe('OptimizedEntry', () => {
  let renderer: TestRenderer | undefined = undefined

  void beforeEach(() => {
    rs.clearAllMocks()
    selectedOptimizationsListener = undefined
    selectedOptimizations.current = undefined
    fetchContentfulEntry.mockImplementation(
      async (descriptor: ManagedEntryDescriptor, _query?: ContentfulEntryQuery) =>
        await Promise.resolve(createEntry(resolveDescriptorId(descriptor))),
    )
    resolveOptimizedEntry.mockImplementation(
      (entry: Entry): ResolvedData<EntrySkeletonType> => ({
        entry,
      }),
    )
  })

  void afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount()
      })
      renderer = undefined
    }
  })

  it('passes the resolved entry to viewport tracking without timing overrides', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry}>content</OptimizedEntry>,
      )
    })

    const viewportOptions = getCallOptions(useViewportTracking)
    expect(viewportOptions.entry).toBe(baselineEntry)
  })

  it('uses React Native interaction tracking defaults', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry}>content</OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(true)
    expect(getCallOptions(useTapTracking).enabled).toBe(true)
  })

  it('applies per-entry view and tap tracking overrides', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps trackViews={false}>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(false)
    expect(getCallOptions(useTapTracking).enabled).toBe(true)
  })

  it('allows per-entry tap tracking opt out', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps={false}>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(true)
    expect(getCallOptions(useTapTracking).enabled).toBe(false)
  })

  it('passes optimizationContextId to viewport and tap tracking', async () => {
    resolveOptimizedEntry.mockReturnValueOnce({
      entry: createEntry('resolved-entry'),
      optimizationContextId: 'ctx-1',
      selectedOptimization: {
        experienceId: 'exp-1',
        sticky: false,
        variantIndex: 1,
        variants: {},
      },
    })
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).optimizationContextId).toBe('ctx-1')
    expect(getCallOptions(useTapTracking).optimizationContextId).toBe('ctx-1')
  })

  it('passes resolved metadata to render props and onEntryResolved', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    const renderedMetadata: string[] = []
    const onEntryResolved = rs.fn()

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} onEntryResolved={onEntryResolved}>
          {(resolved, metadata) => {
            renderedMetadata.push(
              `${metadata.baselineEntryId}:${metadata.entryId}:${metadata.optimizationContextId}`,
            )
            return resolved.sys.id
          }}
        </OptimizedEntry>,
      )
    })

    expect(renderedMetadata).toContain('baseline-entry:baseline-entry:undefined')
    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntry,
        baselineEntryId: 'baseline-entry',
        entry: baselineEntry,
        entryId: 'baseline-entry',
      }),
    )
  })

  it('keeps tracking and resolution callbacks while live updates hide and restore content', async () => {
    const emptySelection: SelectedOptimizationArray = [
      {
        experienceId: 'exp-1',
        variantIndex: 1,
        variants: { 'baseline-entry': 'empty-variant' },
      },
    ]
    const contentSelection: SelectedOptimizationArray = [
      {
        experienceId: 'exp-1',
        variantIndex: 2,
        variants: { 'baseline-entry': 'content-variant' },
      },
    ]
    resolveOptimizedEntry.mockImplementation(
      (entry: Entry, selections?: SelectedOptimizationArray): ResolvedData<EntrySkeletonType> =>
        selections?.[0]?.variantIndex === 1 ? { entry, isEmptyVariant: true } : { entry },
    )
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }
    const render = rs.fn(() => 'content')
    const onEntryResolved = rs.fn()

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} liveUpdates onEntryResolved={onEntryResolved}>
          {render}
        </OptimizedEntry>,
      )
    })
    if (renderer === undefined) throw new Error('Expected component to render')

    expect(renderer.toJSON()).toMatchObject({ type: 'View', children: ['content'] })
    const initialRenderCalls = render.mock.calls.length
    const initialResolvedCalls = onEntryResolved.mock.calls.length

    act(() => {
      selectedOptimizationsListener?.(emptySelection)
    })

    expect(renderer.toJSON()).toMatchObject({ type: 'View', children: null })
    expect(render).toHaveBeenCalledTimes(initialRenderCalls)
    expect(useViewportTracking).toHaveBeenLastCalledWith(
      expect.objectContaining({ entry: baselineEntry }),
    )
    expect(useTapTracking).toHaveBeenLastCalledWith(
      expect.objectContaining({ entry: baselineEntry }),
    )
    expect(onEntryResolved).toHaveBeenLastCalledWith(
      expect.objectContaining({ resolvedData: expect.objectContaining({ isEmptyVariant: true }) }),
    )
    expect(onEntryResolved).toHaveBeenCalledTimes(initialResolvedCalls + 1)

    act(() => {
      selectedOptimizationsListener?.(contentSelection)
    })

    expect(renderer.toJSON()).toMatchObject({ type: 'View', children: ['content'] })
    expect(render.mock.calls.length).toBeGreaterThan(initialRenderCalls)
    expect(onEntryResolved).toHaveBeenCalledTimes(initialResolvedCalls + 2)
  })

  it('renders loadingFallback and skips tracking while managed entryId is loading', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const deferred = createDeferred<Entry>()
    fetchContentfulEntry.mockImplementation(async () => await deferred.promise)

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry
          entryId="baseline-entry"
          entryQuery={{ locale: 'de-DE' }}
          loadingFallback="loading"
        >
          {(resolvedEntry) => resolvedEntry.sys.id}
        </OptimizedEntry>,
      )
    })

    expect(fetchContentfulEntry).toHaveBeenCalledWith('baseline-entry', { locale: 'de-DE' })
    expect(useViewportTracking).not.toHaveBeenCalled()
    expect(useTapTracking).not.toHaveBeenCalled()

    const baselineEntry = createEntry('baseline-entry')
    await act(async () => {
      deferred.resolve(baselineEntry)
      await deferred.promise
    })

    expect(getCallOptions(useViewportTracking).entry).toBe(baselineEntry)
    expect(getCallOptions(useTapTracking).entry).toBe(baselineEntry)
  })

  it('renders managed entryId fetch errors and reports each error once', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const error = new Error('CDA failed')
    const onEntryError = rs.fn()
    fetchContentfulEntry.mockImplementation(async () => await Promise.reject(error))

    await act(async () => {
      renderer = testRenderer.create(
        <OptimizedEntry
          entryId="baseline-entry"
          errorFallback={(entryError) => `error: ${entryError.message}`}
          onEntryError={onEntryError}
        >
          {(resolvedEntry) => resolvedEntry.sys.id}
        </OptimizedEntry>,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onEntryError).toHaveBeenCalledTimes(1)
    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(useViewportTracking).not.toHaveBeenCalled()
    expect(useTapTracking).not.toHaveBeenCalled()
  })

  it('renders loadingFallback, then tracks resolved slug entries with their real metadata IDs', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const deferred = createDeferred<Entry>()
    fetchContentfulEntry.mockImplementation(async () => await deferred.promise)
    const variantEntry = createEntry('variant-entry-id')
    resolveOptimizedEntry.mockReturnValueOnce({ entry: variantEntry })
    const renderedMetadata: string[] = []
    const onEntryResolved = rs.fn()
    const managedEntry = {
      contentType: 'hero',
      entryQuery: { locale: 'de-DE' },
      slug: 'home',
    } as const

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry
          loadingFallback="loading"
          managedEntry={managedEntry}
          onEntryResolved={onEntryResolved}
        >
          {(resolvedEntry, metadata) => {
            renderedMetadata.push(`${metadata.baselineEntryId}:${metadata.entryId}`)
            return resolvedEntry.sys.id
          }}
        </OptimizedEntry>,
      )
    })

    expect(fetchContentfulEntry).toHaveBeenCalledWith(managedEntry)
    expect(renderer?.toJSON()).toBe('loading')
    expect(useViewportTracking).not.toHaveBeenCalled()
    expect(useTapTracking).not.toHaveBeenCalled()

    const baselineEntry = createEntry('baseline-entry-id')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }
    await act(async () => {
      deferred.resolve(baselineEntry)
      await deferred.promise
    })

    expect(getCallOptions(useViewportTracking).entry).toBe(variantEntry)
    expect(getCallOptions(useTapTracking).entry).toBe(variantEntry)
    expect(renderedMetadata).toContain('baseline-entry-id:variant-entry-id')
    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntry,
        baselineEntryId: 'baseline-entry-id',
        entry: variantEntry,
        entryId: 'variant-entry-id',
      }),
    )
  })

  it('renders managed slug fetch errors and reports each error once', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const error = new Error('CDA failed')
    const onEntryError = rs.fn()
    fetchContentfulEntry.mockImplementation(async () => await Promise.reject(error))

    await act(async () => {
      renderer = testRenderer.create(
        <OptimizedEntry
          errorFallback={(entryError) => `error: ${entryError.message}`}
          managedEntry={{ contentType: 'hero', slug: 'home' }}
          onEntryError={onEntryError}
        >
          {(resolvedEntry) => resolvedEntry.sys.id}
        </OptimizedEntry>,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onEntryError).toHaveBeenCalledTimes(1)
    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(renderer?.toJSON()).toBe('error: CDA failed')
    expect(useViewportTracking).not.toHaveBeenCalled()
    expect(useTapTracking).not.toHaveBeenCalled()
  })
})
