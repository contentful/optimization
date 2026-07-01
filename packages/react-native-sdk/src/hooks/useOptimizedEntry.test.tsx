import type { ResolvedData } from '@contentful/optimization-core'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { act } from 'react'
import { loadTestRenderer } from '../test/testRenderer'
import {
  useOptimizedEntry,
  type UseOptimizedEntryParams,
  type UseOptimizedEntryResult,
} from './useOptimizedEntry'

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
      isReady: true,
    })
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
      isReady: false,
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
      isReady: true,
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
      isReady: false,
    })
  })
})
